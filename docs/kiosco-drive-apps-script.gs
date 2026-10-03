/**
 * EventPix Kiosco → Google Drive
 *
 * Recibe las fotos del kiosco y las guarda en la carpeta de Drive que se
 * configura en el equipo (Ajustes → Compartir y nube), con una subcarpeta por
 * evento. Corre con tu cuenta de Google: no hace falta dar claves al kiosco.
 *
 * Cómo instalarlo (una sola vez, desde una computadora):
 *  1. Entrá a https://script.google.com → "Nuevo proyecto".
 *  2. Borrá lo que aparece y pegá todo este archivo. Guardá.
 *  3. "Implementar" → "Nueva implementación" → tipo "Aplicación web".
 *     - Ejecutar como: Yo
 *     - Quién tiene acceso: Cualquier usuario
 *  4. Autorizá los permisos de Drive que pide Google.
 *  5. Copiá la "URL de la aplicación web" (termina en /exec) y pegala en el
 *     kiosco, junto con el link de la carpeta de Drive.
 *
 * Para actualizarlo sin cambiar la URL: pegá el código nuevo, guardá y
 * "Implementar" → "Gestionar implementaciones" → editar (lápiz) →
 * Versión: "Nueva versión" → Implementar.
 *
 * Cualquiera que tenga esa URL puede subir archivos a carpetas a las que tenga
 * acceso tu cuenta: no la publiques.
 */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    // Sin carpeta indicada se usa (o se crea) "EventPix Kiosco" en Mi unidad
    var root;
    if (body.folderId) {
      root = DriveApp.getFolderById(body.folderId);
    } else {
      var def = DriveApp.getRootFolder().getFoldersByName('EventPix Kiosco');
      root = def.hasNext() ? def.next() : DriveApp.getRootFolder().createFolder('EventPix Kiosco');
    }
    if (body.test) return json({ ok: true, folder: root.getName() });

    var folder = root;
    if (body.folder) {
      var found = root.getFoldersByName(body.folder);
      folder = found.hasNext() ? found.next() : root.createFolder(body.folder);
    }
    // Si ya está (reintento), no se duplica
    if (!folder.getFilesByName(body.name).hasNext()) {
      var blob = Utilities.newBlob(Utilities.base64Decode(body.data), body.type || 'image/jpeg', body.name);
      folder.createFile(blob);
    }
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
