from django.urls import path
from . import views

app_name = 'agenda'

urlpatterns = [
    path('', views.DashboardView.as_view(), name='dashboard'),
    path('events/new/', views.EventCreateView.as_view(), name='event_create'),
    path('events/<int:pk>/edit/', views.EventUpdateView.as_view(), name='event_edit'),
    path('events/<int:pk>/delete/', views.EventDeleteView.as_view(), name='event_delete'),
    path('voice/', views.voice_create, name='voice_create'),
    path('events/<int:pk>/complete/', views.mark_complete, name='mark_complete'),
]
