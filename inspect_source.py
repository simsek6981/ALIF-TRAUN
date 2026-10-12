import json
import re
from urllib.request import Request, urlopen
from urllib.parse import urljoin

PAGE = 'https://namazvakitleri.com.tr/sehir/1480/linz-namaz-vakitleri'

def get(url):
    with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=30) as response:
        return response.read().decode('utf-8')

html = get(PAGE)
print('PAGE SCRIPTS', re.findall(r'<script[^>]+src=[\"\']([^\"\']+)', html))
for src in re.findall(r'<script[^>]+src=[\"\']([^\"\']+)', html):
    url = urljoin(PAGE, src)
    if 'namazvakitleri.com.tr' not in url:
        continue
    js = get(url)
    print('SCRIPT', url)
    for match in re.finditer(r'nv-api|getTimes|fetch\(|axios|1480', js):
        print(js[max(0, match.start()-220):match.end()+450])
try:
    raw = get('https://nv-api.com/getTimes/1480')
    data = json.loads(raw)
    print('API TYPE', type(data).__name__)
    print('API SAMPLE', json.dumps(data, ensure_ascii=False)[:6000])
except Exception as error:
    print('API ERROR', repr(error))