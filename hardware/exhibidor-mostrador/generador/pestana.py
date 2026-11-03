# Pestaña con logo y tapita de marca: se generan aparte (la librería falla si van en la misma corrida).
import os, sys, math, numpy as np, trimesh
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'stl')
src = open(os.path.join(HERE, 'exhibidor.py')).read().split("# fantasmas para las vistas")[0]
exec(compile(src, 'exhibidor', 'exec'))
def tm_of(m_):
    mesh = m_.to_mesh()
    return trimesh.Trimesh(vertices=np.asarray(mesh.vert_properties)[:, :3], faces=np.asarray(mesh.tri_verts), process=True)
t = tm_of(tab)
print('pestana~pie', round((tab ^ shell).volume() / 1000, 3), 'pestana~monitor', round((tab ^ monitor).volume() / 1000, 3))
R = trimesh.transformations.rotation_matrix
p = t.copy()
p.apply_translation((0, -y_f, -z_b)); p.apply_transform(R(a, [1, 0, 0])); p.apply_transform(R(math.pi / 2, [1, 0, 0]))
p.apply_translation(-p.bounds[0]); p.export(os.path.join(OUT, 'pestana_logo.stl'))
print('pestana', p.extents.round(1), p.is_watertight, round(p.volume / 1000, 2))
b = tm_of(brand); b.apply_translation(-b.bounds[0]); b.export(os.path.join(OUT, 'tapa_marca_costado.stl'))
print('tapa', b.extents.round(1), b.is_watertight)
