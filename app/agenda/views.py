import json
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.urls import reverse_lazy
from django.views.generic import ListView, CreateView, UpdateView, DeleteView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.utils import timezone
from datetime import timedelta
from .models import Event
from .forms import EventForm
from .parser import parse_command


class DashboardView(LoginRequiredMixin, ListView):
    model = Event
    template_name = 'agenda/dashboard.html'
    context_object_name = 'events'

    def get_queryset(self):
        now = timezone.now()
        return Event.objects.filter(
            user=self.request.user,
            start_datetime__gte=now,
        ).order_by('start_datetime')[:50]


class EventCreateView(LoginRequiredMixin, CreateView):
    model = Event
    form_class = EventForm
    template_name = 'agenda/event_form.html'
    success_url = reverse_lazy('agenda:dashboard')

    def form_valid(self, form):
        form.instance.user = self.request.user
        return super().form_valid(form)


class EventUpdateView(LoginRequiredMixin, UpdateView):
    model = Event
    form_class = EventForm
    template_name = 'agenda/event_form.html'
    success_url = reverse_lazy('agenda:dashboard')

    def get_queryset(self):
        return Event.objects.filter(user=self.request.user)


class EventDeleteView(LoginRequiredMixin, DeleteView):
    model = Event
    template_name = 'agenda/event_confirm_delete.html'
    success_url = reverse_lazy('agenda:dashboard')

    def get_queryset(self):
        return Event.objects.filter(user=self.request.user)


@login_required
@csrf_exempt
def voice_create(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Método no permitido'}, status=405)

    try:
        data = json.loads(request.body)
        text = data.get('text', '').strip()
    except (json.JSONDecodeError, KeyError):
        return JsonResponse({'error': 'JSON inválido'}, status=400)

    if not text:
        return JsonResponse({'error': 'Texto vacío'}, status=400)

    parsed = parse_command(text)
    now = timezone.now()

    start = parsed.get('start_datetime', now)
    end = parsed.get('end_datetime', start + timedelta(hours=1))

    event = Event.objects.create(
        user=request.user,
        title=parsed.get('title', 'Evento sin título'),
        start_datetime=start,
        end_datetime=end,
    )

    return JsonResponse({
        'id': event.id,
        'title': event.title,
        'start_datetime': event.start_datetime.isoformat(),
        'end_datetime': event.end_datetime.isoformat(),
    })
