import requests
from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.parsers import MultiPartParser, FormParser

class PredictView(APIView):
    permission_classes = [AllowAny]
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        image_file = request.FILES.get('image')

        if not image_file:
            return Response({'error': 'Image is required'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Send image to DL Service
        try:
            # We need to seek back to start if we read it multiple times, but here it's new
            files = {'file': (image_file.name, image_file.read(), image_file.content_type)}
            dl_response = requests.post(settings.DL_SERVICE_URL, files=files)
            dl_response.raise_for_status()
            dl_result = dl_response.json()
        except Exception as e:
            return Response({'error': f'DL Service error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # History saving removed. Frontend will handle saving if the user chooses to.

        return Response(dl_result)
