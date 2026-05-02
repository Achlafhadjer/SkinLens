from django.urls import path
from .views import HistoryListView, HistoryDetailView

urlpatterns = [
    path('history/', HistoryListView.as_view(), name='history-list'),
    path('history/<int:pk>/', HistoryDetailView.as_view(), name='history-detail'),
]
