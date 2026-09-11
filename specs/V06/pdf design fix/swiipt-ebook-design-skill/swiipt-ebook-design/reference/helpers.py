import re, os

ICON_DIR = os.path.join(os.path.dirname(__file__), "icons")

def icon(name, color="currentColor", size=16, stroke_width=None):
    path = os.path.join(ICON_DIR, f"{name}.svg")
    with open(path, "r") as f:
        svg = f.read()
    svg = re.sub(r'width="24"', f'width="{size}"', svg)
    svg = re.sub(r'height="24"', f'height="{size}"', svg)
    if stroke_width:
        svg = re.sub(r'stroke-width="2"', f'stroke-width="{stroke_width}"', svg)
    if color != "currentColor":
        svg = svg.replace('stroke="currentColor"', f'stroke="{color}"')
    return svg

def page_open(classes="page"):
    return f'<div class="{classes}">'

def page_close():
    return '</div>'

def footer_strap(label):
    mark_svg = icon("moon-star", color="#7B8794", size=9)
    return f'''
    <div class="footer-strap">
      <div class="mark">{mark_svg} EVERY NIGHT, JUST ME</div>
      <div>{label}</div>
    </div>'''
