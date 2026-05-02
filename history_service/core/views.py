from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from .models import History
from .serializers import HistorySerializer

class HistoryListView(APIView):
    permission_classes = [AllowAny] # In production, restrict to internal or use JWT

    def get(self, request):
        user_id = request.query_params.get('user_id')
        if not user_id:
            return Response({'error': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        history = History.objects.filter(user_id=user_id).order_by('-created_at')
        serializer = HistorySerializer(history, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = HistorySerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class HistoryDetailView(APIView):
    permission_classes = [AllowAny]

    def delete(self, request, pk):
        try:
            history = History.objects.get(pk=pk)
            history.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except History.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

    def patch(self, request, pk):
        try:
            history = History.objects.get(pk=pk)
            custom_title = request.data.get('custom_title')
            if custom_title is not None:
                result = history.result
                if isinstance(result, dict):
                    result['custom_title'] = custom_title
                    history.result = result
                    history.save()
                    return Response({'status': 'updated'})
            return Response({'error': 'no custom_title provided'}, status=status.HTTP_400_BAD_REQUEST)
        except History.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
