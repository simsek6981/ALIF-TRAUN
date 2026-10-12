"""Fetch the exact Linz source payload; never calculate or offset prayer times."""
import argparse
import json
import re
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

API = 'https://nv-api.com/getTimes/1480'
PAGE = 'https://namazvakitleri.com.tr/sehir/1480/linz-namaz-vakitleri'
KEYS = ('imsak', 'gunes', 'ogle', 'ikindi', 'aksam', 'yatsi')


def validate(payload):
    if str(payload.get('CityInfo', {}).get('id')) != '1480' or payload.get('Info', {}).get('Status') != 'Success':
        raise ValueError('Source did not return successful Linz data')
    rows = payload.get('PrayerTimes')
    if not isinstance(rows, list) or not rows:
        raise ValueError('Empty prayer calendar')
    seen = set()
    for row in rows:
        day = date.fromisoformat(row['date'])
        if day.isoformat() != row['date'] or day in seen:
            raise ValueError('Invalid or duplicated source date')
        seen.add(day)
        previous = -1
        for key in KEYS:
            value = row.get(key)
            if not isinstance(value, str) or not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d', value):
                raise ValueError(f'Invalid source time: {key}')
            h, m = map(int, value.split(':'))
            minutes = h * 60 + m
            if minutes <= previous:
                raise ValueError('Source times are not ordered')
            previous = minutes
    today = datetime.now(ZoneInfo('Europe/Vienna')).date()
    if today not in seen or today + timedelta(days=1) not in seen:
        raise ValueError('Source is missing today or tomorrow; retain last good data')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default='data/linz.json')
    args = parser.parse_args()
    for attempt in range(3):
        try:
            request = Request(API, headers={'User-Agent': 'ALIF-Traun-PrayerTimes/1.0', 'Accept': 'application/json'})
            with urlopen(request, timeout=30) as response:
                payload = json.load(response)
            validate(payload)
            break
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))
    payload['_alif'] = {
        'sourceUrl': PAGE,
        'sourceApi': API,
        'fetchedAt': datetime.now(timezone.utc).isoformat(),
        'timeZone': 'Europe/Vienna',
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix('.tmp')
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(output)
    today = datetime.now(ZoneInfo('Europe/Vienna')).date().isoformat()
    row = next(row for row in payload['PrayerTimes'] if row['date'] == today)
    print('Linz source synchronized:', today, ', '.join(f'{key}={row[key]}' for key in KEYS))


if __name__ == '__main__':
    main()
