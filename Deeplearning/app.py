from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
import torch.nn.functional as F
import os
import time

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# ❗ نفس الكلاسات بدون Healthy (كما في training)
classes_list = [
    'Actinic keratoses',
    'Basal cell carcinoma',
    'Benign keratosis',
    'Chickenpox',
    'Cowpox',
    'Dermatofibroma',
    'HFMD',
    'Measles',
    'Melanocytic nevi',
    'Melanoma',
    'Monkeypox',
    'Squamous cell carcinoma',
    'Vascular lesions'
]

NUM_CLASSES = len(classes_list)

# ✅ نفس الموديل EXACTLY كما في training
device = torch.device("cpu")

model = models.efficientnet_v2_s(weights=None)

num_ftrs = model.classifier[1].in_features
model.classifier[1] = nn.Sequential(
    nn.Linear(num_ftrs, 512),
    nn.BatchNorm1d(512),
    nn.ReLU(),
    nn.Dropout(0.6),
    nn.Linear(512, 256),
    nn.BatchNorm1d(256),
    nn.ReLU(),
    nn.Dropout(0.4),
    nn.Linear(256, NUM_CLASSES)
)

# تحميل weights
# Ensure the model file exists before loading
model_path = os.path.join(os.path.dirname(__file__), "best_modell.pth")
if os.path.exists(model_path):
    model.load_state_dict(torch.load(model_path, map_location=device))
model.eval()

# نفس transform تاع validation
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225])
])

@app.route('/')
def home():
    return render_template("index.html")

@app.route('/api/predict/', methods=['POST'])
def predict():
    # Check for both 'file' (Deeplearning index.html) and 'image' (SkinLens prediction_service)
    file = request.files.get('file') or request.files.get('image')
    if not file:
        return jsonify({"error": "No file uploaded"}), 400

    image = Image.open(file).convert("RGB")
    image = transform(image).unsqueeze(0)

    with torch.no_grad():
        outputs = model(image)
        probs = F.softmax(outputs, dim=1)

    top3_prob, top3_idx = torch.topk(probs, 3)

    results = []
    for i in range(3):
        idx = top3_idx[0][i].item()
        prob = top3_prob[0][i].item()

        results.append({
            "label": classes_list[idx],
            "confidence": round(prob * 100, 2)
        })

    return jsonify({"top3": results})

@app.route('/api/chat/', methods=['POST'])
def chat():
    data = request.json
    user_msg = data.get('message')
    history = data.get('history', [])
    
    api_key = os.environ.get("GEMINI_API_KEY")
    
    if api_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            genai_model = genai.GenerativeModel('gemini-2.0-flash') # Using flash for speed
            
            gemini_history = [
                {"role": "user", "parts": ["Tu es SkinBot, un assistant dermatologique IA créé pour le projet Skin AI. Réponds toujours en français, sois très organisé dans tes réponses. Utilise des paragraphes courts, des listes à puces avec des tirets, et du texte en gras (avec **) pour mettre en évidence les informations importantes. Utilise des emojis appropriés (comme 👨‍⚕️, 🩺, 💡, ⚠️, 🌿) pour rendre la lecture plus agréable. Sois professionnel mais empathique. Rappelle TOUJOURS que tu ne remplaces pas un avis médical."]},
                {"role": "model", "parts": ["Compris. Je suis SkinBot et je suis prêt à vous aider en français."]}
            ]
            
            if history:
                for msg in history:
                    role = "user" if msg.get('sender') == "user" else "model"
                    gemini_history.append({"role": role, "parts": [msg.get('text')]})
            
            chat_session = genai_model.start_chat(history=gemini_history)
            response = chat_session.send_message(user_msg)
            return jsonify({"reply": response.text})
        except Exception as e:
            print("Gemini error:", str(e))
            return jsonify({"reply": f"Désolé, j'ai rencontré une erreur avec mon moteur de réflexion. ({str(e)})"}), 500

    time.sleep(1)
    return jsonify({
        "reply": "⚠️ L'API Gemini n'est pas encore configurée (Clé API manquante dans le fichier .env). Pour rendre ce chatbot intelligent et permanent, veuillez ajouter `GEMINI_API_KEY=votre_cle` dans le fichier .env de votre projet."
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)
