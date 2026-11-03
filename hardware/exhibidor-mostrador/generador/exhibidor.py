# Exhibidor de mostrador v3: pie DETRÁS del monitor (monitor casi apoyado en la mesa).
# Monitor 15,6" en vertical, inclinado; la plaqueta HDMI y el Tanix W2 van dentro del pie.
# Marco: tope abajo + agarres laterales con labio. Antirrobo: 2 tornillos a la mesa
# desde adentro + traba superior atornillada desde adentro.
# Unidades mm. X = ancho (mirando de frente, izq->der), Y = profundidad (frente=0), Z = alto.
import sys, json, math, os, pickle, numpy as np, trimesh
from manifold3d import Manifold as M, CrossSection as CS, set_circular_segments
set_circular_segments(40)

P = dict(mon_w=224.0, mon_h=355.0, t_thin=6.0, t_thick=12.0, strip_w=70.0,
         fit=0.5, tilt=15.0, wall=3.0, floor_t=6.0,
         sb=16.5,            # espalda del soporte (espesor monitor+soporte, medido desde el frente del monitor)
         Hw=120.0,           # alto del soporte a lo largo del monitor
         D=142.0, Hb=40.0,   # profundidad del pie y alto de la pared de atrás
         lip_strip=14.0, lip=3.0, lip_t=2.5, lip_h=4.5, tab_w=60.0, tab_rise=10.0, tab_t=2.0,
         brand_w=19.0, brand_len=80.0,
         cost_x0=108.0, cost_w=15.0,
         strap_cx=160.0, strap_w=22.0, strap_t=5.0, strap_w0=90.0,
         tx=105.0, ty=105.0, tz=18.0, jack_d=8.0)
if len(sys.argv) > 1: P.update(json.loads(sys.argv[1]))
g = type('G', (), P)
f = g.fit
W = g.wall + f + g.mon_w + f + g.wall
x0 = g.wall + f                       # borde izquierdo del monitor
xs = x0 + g.strip_w                   # fin de la franja gruesa (izquierda)
a = math.radians(g.tilt); ca, sa = math.cos(a), math.sin(a)
# borde inferior-delantero del monitor: apoyado sobre el piso
y_f = 6.0
z_b = g.floor_t + g.t_thick * sa + 0.8

def Y(v, w): return y_f + v * ca + w * sa
def Z(v, w): return z_b - v * sa + w * ca
def box(x0_, x1, y0, y1, z0, z1): return M.cube((x1 - x0_, y1 - y0, z1 - z0)).translate((x0_, y0, z0))
def tilted(m_): return m_.rotate((-g.tilt, 0, 0)).translate((0, y_f, z_b))
YZ = [[0, 0, 1, 0], [1, 0, 0, 0], [0, 1, 0, 0]]          # (a,b,h) -> (x=h, y=a, z=b)
def ccw(pts):
    pts = [(float(p[0]), float(p[1])) for p in pts]
    area = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))
    return pts if area > 0 else pts[::-1]
def prism_yz(pts, x_lo, x_hi):
    return M.extrude(CS([ccw(pts)]), x_hi - x_lo).transform(YZ).translate((x_lo, 0, 0))
def poly_uw(pts, v_lo, v_hi):                            # polígono en (u, w), espesor en v
    return tilted(M.extrude(CS([ccw(pts)]), v_hi - v_lo).transform([[1, 0, 0, 0], [0, 0, 1, 0], [0, 1, 0, 0]]).translate((0, v_lo, 0)))

# ---------- monitor (y su lugar con juego) ----------
def mon_local(ff, extra_top=0):
    return (box(x0 - ff, xs + 1, -ff, g.t_thick + ff, 0 - ff * 0, g.mon_h + ff + extra_top)
            + box(xs + 1, x0 + g.mon_w + ff, -ff, g.t_thin + ff, 0, g.mon_h + ff + extra_top))
monitor = tilted(mon_local(0))
mon_cut = tilted(mon_local(f, 200))

# ---------- perfil lateral ----------
E = (Y(g.sb, g.Hw), Z(g.sb, g.Hw))
Wf = (Y(-f - g.lip_t, g.Hw), Z(-f - g.lip_t, g.Hw))
Wb = (Y(-f - g.lip_t, -8), Z(-f - g.lip_t, -8))
side_poly = [(0, 0), (g.D, 0), (g.D, g.Hb), E, Wf, (max(Wb[0], 0.5), max(Wb[1], 0)), (0, max(Wb[1], 0))]
side_L = prism_yz(side_poly, 0, g.wall)
side_R = prism_yz(side_poly, W - g.wall, W)

floor = box(0, W, 0, g.D, 0, g.floor_t)
back = box(0, W, g.D - g.wall, g.D, 0, g.Hb)
seat = tilted(box(0, W, -f - 3, g.sb, -14, 0.01)) ^ box(0, W, 0, g.D, 0, 100)
support = tilted(box(0, xs + 1, g.t_thick + f, g.sb, -10, g.Hw) + box(xs + 1, W, g.t_thin + f, g.sb, -10, g.Hw)) ^ box(-1, W + 1, 0, g.D, 0, 500)
lip_bottom = tilted(box(0, W, -f - 3, -f, -8, g.lip_h)) ^ box(-1, W + 1, 0, g.D, 0, 500)
lip_L = tilted(box(0, x0 + g.lip_strip, -f - g.lip_t, -f, -8, g.Hw)) ^ box(-1, W + 1, 0, g.D, 0, 500)
lip_R = tilted(box(x0 + g.mon_w - g.lip, W, -f - g.lip_t, -f, -8, g.Hw)) ^ box(-1, W + 1, 0, g.D, 0, 500)

# repisas para el techo (debajo del plano del techo, 8 mm de espesor)
C = (g.D, g.Hb)
dx, dz = C[0] - E[0], C[1] - E[1]; L_roof = math.hypot(dx, dz)
nrm = (-dz / L_roof, dx / L_roof)                      # normal hacia afuera (arriba-atrás)
if nrm[1] < 0: nrm = (-nrm[0], -nrm[1])
def roof_band(th):
    return [E, C, (C[0] - nrm[0] * th, C[1] - nrm[1] * th), (E[0] - nrm[0] * th, E[1] - nrm[1] * th)]
ledge_L = prism_yz(roof_band(8), 0, g.wall + 10)
ledge_R = prism_yz(roof_band(8), W - g.wall - 10, W)
ledge_C = prism_yz(roof_band(8), g.cost_x0, g.cost_x0 + g.cost_w)

shell = side_L + side_R + floor + back + seat + support + lip_bottom + lip_L + lip_R + ledge_L + ledge_R + ledge_C
shell = shell - mon_cut
# ventana en el soporte para pasar las cintas de la plaqueta (franja gruesa), punta a 45° para imprimir sin soporte
u1, u2 = x0 + 4, xs - 4
shell = shell - poly_uw([(u1, 15), (u2 - 40, 15), (u2, 55), (u2 - 40, 95), (u1, 95)], g.t_thick, g.sb + 2)
# traba superior: canal en el soporte + 2 tornillos desde adentro
cx = g.strap_cx
shell = shell - tilted(box(cx - g.strap_w / 2 - 0.5, cx + g.strap_w / 2 + 0.5, g.t_thin + f - 0.1, g.t_thin + f + g.strap_t + 0.3, g.strap_w0 - 2, g.Hw + 1))
strap_screws_w = [g.strap_w0 + 9, g.strap_w0 + 23]
for ww in strap_screws_w:
    shell = shell - tilted(M.cylinder(20, 1.7).rotate((-90, 0, 0)).translate((cx, g.t_thin + f, ww)))
# Tanix (a la derecha, sobre el piso) y agujeros
tan_x1 = W - g.wall - 3; tan_x0 = tan_x1 - g.tx
tan_y0 = 34.0; tan_y1 = tan_y0 + g.ty
tanix = box(tan_x0, tan_x1, tan_y0, tan_y1, g.floor_t, g.floor_t + g.tz)
# tornillos a la mesa: cabeza adentro (uno queda debajo del Tanix)
table_screws = [(40.0, 118.0), ((tan_x0 + tan_x1) / 2, (tan_y0 + tan_y1) / 2)]
for sx, sy in table_screws:
    shell = shell - M.cylinder(g.floor_t + 2, 2.3).translate((sx, sy, -1))
    shell = shell - M.cylinder(10, 4.6).translate((sx, sy, 3))
# ventilación en la pared derecha (frente al Tanix)
for yy in np.arange(tan_y0 + 6, tan_y1 - 6, 8):
    shell = shell - box(W - g.wall - 1, W + 1, yy, yy + 4, g.floor_t + 3, g.floor_t + 26)
# jack de alimentación atrás (izquierda)
shell = shell - M.cylinder(g.wall + 2, g.jack_d / 2).rotate((-90, 0, 0)).translate((60, g.D - g.wall - 1, 22))
# agujeros guía en las repisas del techo (tornillos M3 autorroscantes)
roof_holes_s = [0.28 * L_roof, 0.78 * L_roof]
roof_holes_x = [g.wall + 5, g.cost_x0 + 3.5, g.cost_x0 + g.cost_w - 3.5, W - g.wall - 5]
def roof_pt(s): return (E[0] + dx / L_roof * s, E[1] + dz / L_roof * s)
ang = math.degrees(math.atan2(nrm[1], nrm[0]))
for s in roof_holes_s:
    py, pz = roof_pt(s)
    for hx in roof_holes_x:
        # agujero perpendicular al techo
        cyl = M.cylinder(12, 1.25).translate((0, 0, -11))       # eje z, de -11 a 1
        cyl = cyl.rotate((90 - ang, 0, 0)) if False else cyl
        # orientar el eje z según la normal (nrm en YZ): rotar alrededor de X
        rot = math.degrees(math.atan2(-nrm[0], nrm[1]))          # z -> (0, nrm)
        shell = shell - M.cylinder(12, 1.25).translate((0, 0, -11)).rotate((rot, 0, 0)).translate((hx, py, pz))

# ---------- techo (2 tapas planas) ----------
def roof_panel(xa, xb, vents=False):
    w_ = xb - xa
    p = box(0, w_, 0, L_roof, 0, 3)
    for s in roof_holes_s:
        for hx in roof_holes_x:
            if xa - 0.1 <= hx <= xb + 0.1:
                lx = hx - xa
                p = p - M.cylinder(5, 1.7).translate((lx, s, -1))
                p = p - M.cylinder(1.8, 1.7, 3.4).translate((lx, s, 1.3))   # avellanado
    if vents:
        for vx in np.arange(20, w_ - 20, 8):
            p = p - box(vx, vx + 4, L_roof * 0.45, L_roof * 0.9, -1, 4)
    return p
mid = g.cost_x0 + g.cost_w / 2
roof_L = roof_panel(0, mid)
roof_R = roof_panel(mid, W, vents=True)
# techo ubicado en el armado (para las vistas)
rot_roof = math.degrees(math.atan2(dz, dx))
def place_roof(pnl, xa):
    # el panel está en (x, s, t): s a lo largo del techo desde E, t hacia afuera
    return pnl.rotate((rot_roof, 0, 0)).translate((xa, E[0], E[1]))

# ---------- traba superior ----------
top = g.mon_h + f
strap = tilted(box(cx - g.strap_w / 2, cx + g.strap_w / 2, g.t_thin + f, g.t_thin + f + g.strap_t, g.strap_w0, top + 4)
               + box(cx - g.strap_w / 2, cx + g.strap_w / 2, -f - g.lip_t, g.t_thin + f + g.strap_t, top, top + 4)
               + box(cx - g.strap_w / 2, cx + g.strap_w / 2, -f - g.lip_t, -f, top - g.lip, top + 4))
for ww in strap_screws_w:
    strap = strap - tilted(M.cylinder(20, 1.25).rotate((-90, 0, 0)).translate((cx, g.t_thin + f - 1, ww)))

# pestaña con logo (pieza aparte, se pega sobre el tope del frente, al centro)
tcx = W / 2
tab = tilted(box(tcx - g.tab_w / 2, tcx + g.tab_w / 2, -f - 3 - g.tab_t, -f, -8, g.lip_h + g.tab_rise))
lip_clear = tilted(box(tcx - g.tab_w / 2 - 1, tcx + g.tab_w / 2 + 1, -f - 3 - 0.2, 5, -20, g.lip_h + 0.2))
tab = tab - lip_clear
tab = tab - tilted(mon_local(f, 200))   # copia propia del hueco del monitor
tab = tab - box(-1, W + 1, 0, g.D, -1, g.floor_t + 0.2)
tab = tab ^ box(-1, W + 1, -20, g.D, 0.0, 500)
# tapita para cubrir la marca del costado (franja ancha, mirando de frente a la izquierda)
brand = M.cube((g.brand_w, g.brand_len, 1.2))
# fantasmas para las vistas: plaqueta (detrás del soporte, franja gruesa) y ficha HDMI
board = tilted(box(x0 + 6, x0 + 66, g.sb + 1, g.sb + 14, 20, 76))
chain = tilted(box(x0 + 66, x0 + 141, g.sb + 3, g.sb + 14, 40, 61))

# ---------- partes ----------
def clip(m_, lo, hi): return m_ ^ box(lo, hi, -500, 500, -500, 500)
parts = {
    'lado_izquierdo': clip(shell, -1, g.cost_x0),
    'costilla_central': clip(shell, g.cost_x0, g.cost_x0 + g.cost_w),
    'lado_derecho': clip(shell, g.cost_x0 + g.cost_w, W + 1),
    'techo_izquierdo': roof_L, 'techo_derecho': roof_R,
    'traba_superior': strap,
    'prueba_esquina_izquierda': shell ^ box(-1, 42, -1, 40, -1, 50),
    'prueba_esquina_derecha': shell ^ box(W - 42, W + 1, -1, 40, -1, 50),
}
def to_tm(m_):
    mesh = m_.to_mesh()
    t = trimesh.Trimesh(vertices=np.asarray(mesh.vert_properties)[:, :3], faces=np.asarray(mesh.tri_verts), process=True)
    bodies = [b for b in t.split(only_watertight=False) if abs(b.volume) > 1.0]   # descarta astillas de volumen 0
    return trimesh.util.concatenate(bodies) if len(bodies) > 1 else bodies[0]
R = trimesh.transformations.rotation_matrix
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'stl')
os.makedirs(out, exist_ok=True)
info = {'W': round(W, 1), 'D': g.D, 'alto_pie': round(max(E[1], Wf[1]), 1), 'alto_total': round(Z(0, g.mon_h), 1)}
for name, part in parts.items():
    tm = to_tm(part)
    if name in ('costilla_central', 'prueba_esquina_izquierda'):
        tm.apply_transform(R(-math.pi / 2, [0, 1, 0]))          # cara x=0 sobre la cama
    if name in ('prueba_esquina_derecha',):
        tm.apply_transform(R(math.pi / 2, [0, 1, 0]))           # cara x=W sobre la cama
    if name == 'pestana_logo':
        tm.apply_translation((0, -y_f, -z_b))
        tm.apply_transform(R(a, [1, 0, 0]))                      # deshacer inclinación
        tm.apply_transform(R(-math.pi / 2, [1, 0, 0]))           # frente (cara del logo) sobre la cama
    if name == 'traba_superior':
        tm.apply_translation((0, -y_f, -z_b))
        tm.apply_transform(R(a, [1, 0, 0]))                      # deshacer inclinación
        tm.apply_transform(R(-math.pi / 2, [1, 0, 0]))           # espalda sobre la cama
        tm.apply_transform(R(math.pi / 4, [0, 0, 1]))            # en diagonal
    tm.apply_translation(-tm.bounds[0])
    tm.export(f'{out}/{name}.stl')
    info[name] = {'mm': [round(v, 1) for v in tm.extents], 'ok': bool(tm.is_watertight), 'cm3': round(tm.volume / 1000, 1)}
# choques
def vol(m1, m2): return round((m1 ^ m2).volume() / 1000, 3)
checks = {'monitor~pie': vol(monitor, shell), 'monitor~traba': vol(monitor, strap), 'tanix~pie': vol(tanix, shell),
          'plaqueta~pie': vol(board, shell), 'ficha~pie': vol(chain, shell), 'ficha~tanix': vol(chain, tanix),
          'traba~pie': vol(strap, shell), 'techoL~pie': vol(place_roof(roof_L, 0), shell), 'techoR~pie': vol(place_roof(roof_R, mid), shell),
          'monitor~techo': vol(monitor, place_roof(roof_R, mid) + place_roof(roof_L, 0))}
info['choques_cm3'] = checks
print(json.dumps(info, indent=1))
