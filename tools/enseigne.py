"""Remplace le texte d'une enseigne rectangulaire d'une image générée par un vrai texte (ex. hangeul).
Usage : python enseigne.py <entrée.png> <sortie.png> <x0> <y0> <x1> <y1> <texte> [police.ttf]
La zone (x0, y0, x1, y1) est l'intérieur de l'enseigne, sans le cadre. Le fond garde l'éclairage d'origine
(médiane par ligne des pixels rouges), le texte est crème avec un léger halo, comme une enseigne lumineuse."""
import sys, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

src, dst = sys.argv[1], sys.argv[2]
x0, y0, x1, y1 = map(int, sys.argv[3:7])
texte = sys.argv[7]
police = sys.argv[8] if len(sys.argv) > 8 else r"C:\Windows\Fonts\malgunbd.ttf"

im = Image.open(src).convert("RGB")
px = im.load()
w, h = x1 - x0, y1 - y0

# fond : pour chaque ligne, médiane des pixels « rouge enseigne » (R fort, G et B bas) → garde le dégradé de lumière
def med(v):
    v = sorted(v); return v[len(v) // 2]
fond = Image.new("RGB", (w, h))
fp = fond.load()
rng = random.Random(7)
prec = None
for y in range(h):
    rouges = [px[x0 + x, y0 + y] for x in range(w) if px[x0 + x, y0 + y][0] > 150 and px[x0 + x, y0 + y][1] < 110]
    c = (med([r for r, g, b in rouges]), med([g for r, g, b in rouges]), med([b for r, g, b in rouges])) if len(rouges) > w // 5 else prec
    prec = c = c or (220, 60, 60)
    for x in range(w):
        bord = min(x, w - 1 - x) / max(1, w * 0.08)  # léger assombrissement vers les bords, comme un caisson lumineux
        k = 0.9 + 0.1 * min(1, bord)
        n = rng.randint(-6, 6)
        fp[x, y] = tuple(max(0, min(255, int(v * k) + n)) for v in c)

# texte : taille ajustée pour remplir ~84 % de la largeur et ~62 % de la hauteur
d = ImageDraw.Draw(fond)
taille = h
while taille > 10:
    f = ImageFont.truetype(police, taille)
    bx = d.textbbox((0, 0), texte, font=f)
    if bx[2] - bx[0] <= w * 0.84 and bx[3] - bx[1] <= h * 0.62:
        break
    taille -= 2
tx = (w - (bx[2] - bx[0])) // 2 - bx[0]
ty = (h - (bx[3] - bx[1])) // 2 - bx[1]
halo = Image.new("L", (w, h), 0)
ImageDraw.Draw(halo).text((tx, ty), texte, font=f, fill=255)
halo = halo.filter(ImageFilter.GaussianBlur(h * 0.05))
fond.paste(Image.new("RGB", (w, h), (255, 190, 150)), (0, 0), halo.point(lambda v: v * 0.55))
d.text((tx, ty), texte, font=f, fill=(250, 222, 178))

im.paste(fond, (x0, y0))
im.save(dst)
print("texte", ascii(texte), "taille", taille)
