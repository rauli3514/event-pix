# Guía rápida para el cliente

Hoja A5 de frente y dorso para dejar con cada equipo (Digital Box y Display Desktop).
Lista para imprimir: [`guia-rapida.pdf`](guia-rapida.pdf).

- **Frente, instalación:** conectar el Digital Box a la TV o enchufar el Display Desktop,
  cambiar el Wi-Fi (OK mientras dice "Conectando…"), qué hacer si aparece un código y
  cuidados del equipo.
- **Dorso, uso diario:** entrar a app.event-pix.com.ar con el usuario y la contraseña que se
  le da a cada cliente (hay una línea para anotar el usuario), Medios → Playlists →
  Pantallas → Programación, apps disponibles y "si algo no anda".
- Contacto en los dos lados: WhatsApp 362 454-7382 (solo mensajes), lunes a sábado de 9 a
  20 h, displaydigital26@gmail.com.

Imprimir en A5, doble faz, en blanco y negro.

## Cambiar la guía

Editar `guia-rapida.html` y regenerar el PDF:

```bash
node docs/guia-rapida/generar-pdf.cjs
```

Revisar que cada lado siga entrando en una sola hoja (el PDF tiene que tener 2 páginas y el
recuadro negro de contacto tiene que verse completo abajo).
