import re
from datetime import datetime, timedelta, date
from django.utils import timezone

SPANISH_DAYS = {
    'lunes': 0, 'martes': 1, 'miércoles': 2, 'miercoles': 2,
    'jueves': 3, 'viernes': 4, 'sábado': 5, 'sabado': 5, 'domingo': 6,
}

SPANISH_MONTHS = {
    'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
    'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
    'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
}

TIME_REFERENCES = {
    'mediodía': (12, 0),
    'medio dia': (12, 0),
    'medianoche': (0, 0),
    'media noche': (0, 0),
}


def parse_command(text: str) -> dict:
    now = timezone.localtime(timezone.now())
    text_lower = text.lower().strip()

    title = text_lower
    event_date = _extract_date(text_lower, now)
    hour, minute = _extract_time(text_lower, event_date)

    for keyword in ['mediodía', 'medio dia', 'medianoche', 'media noche']:
        if keyword in text_lower:
            title = title.replace(keyword, '')

    title = re.sub(r'\ba las\b.*', '', title).strip()
    title = re.sub(r'\ba la\b.*', '', title).strip()
    for word in ['hoy', 'mañana', 'pasado mañana', 'lunes', 'martes', 'miercoles',
                 'miércoles', 'jueves', 'viernes', 'sabado', 'sábado', 'domingo',
                 'de la mañana', 'de la tarde', 'de la noche', 'del medio dia',
                 'del mediodía']:
        title = title.replace(f' {word}', '').replace(f'{word} ', '')
    title = re.sub(r'\s+', ' ', title).strip()
    title = title.capitalize() if title else 'Evento sin título'

    start_dt = timezone.make_aware(
        datetime(event_date.year, event_date.month, event_date.day, hour, minute),
    )

    if start_dt < now:
        start_dt += timedelta(days=1)

    return {
        'title': title,
        'start_datetime': start_dt,
        'end_datetime': start_dt + timedelta(hours=1),
    }


def _extract_date(text: str, now: datetime) -> date:
    today = now.date()

    if 'pasado mañana' in text or 'pasado manana' in text:
        return today + timedelta(days=2)

    if 'mañana' in text or 'manana' in text:
        return today + timedelta(days=1)

    if 'hoy' in text:
        return today

    for name, num in SPANISH_DAYS.items():
        if name in text:
            days_ahead = num - today.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            return today + timedelta(days=days_ahead)

    match = re.search(r'(\d{1,2})\s+de\s+(\w+)', text)
    if match:
        day = int(match.group(1))
        month_name = match.group(2).lower()
        month = SPANISH_MONTHS.get(month_name)
        if month:
            year = today.year
            try:
                parsed = date(year, month, day)
                if parsed < today:
                    parsed = date(year + 1, month, day)
                return parsed
            except ValueError:
                pass

    match = re.search(r'(\d{1,2})/(\d{1,2})', text)
    if match:
        day, month = int(match.group(1)), int(match.group(2))
        year = today.year
        try:
            parsed = date(year, month, day)
            if parsed < today:
                parsed = date(year + 1, month, day)
            return parsed
        except ValueError:
            pass

    return today


def _extract_time(text: str, event_date: date) -> tuple:
    for keyword, (h, m) in TIME_REFERENCES.items():
        if keyword in text:
            period = _extract_period(text, h)
            return (period, m)

    match = re.search(r'a\s+las\s+(\d{1,2})(?::(\d{2}))?', text)
    if not match:
        match = re.search(r'a\s+la\s+(\d{1,2})(?::(\d{2}))?', text)
    if not match:
        match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*de\s+la\s+(mañana|tarde|noche)', text)
    if not match:
        match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*h', text)

    if match:
        hour = int(match.group(1))
        minute = int(match.group(2)) if match.group(2) else 0
        period = _extract_period(text, hour)
        return (period, minute)

    return (9, 0)


def _extract_period(text: str, hour: int) -> int:
    if 'de la tarde' in text or 'de la noche' in text:
        if hour < 12:
            return hour + 12
    elif 'de la mañana' in text or 'del mediodía' in text or 'del medio dia' in text:
        if hour == 12 and ('mediodía' in text or 'medio dia' in text):
            return 12
        if hour >= 12:
            return hour - 12
    return hour
