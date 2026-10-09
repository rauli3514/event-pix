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
 *
 * Panel admin (ver y borrar fotos del kiosco, "Enviar álbum a Drive"):
 * en el editor del script → "Configuración del proyecto" (engranaje) →
 * "Propiedades del script" → Agregar: nombre ADMIN_KEY, valor una clave larga
 * que inventes. Después, en Supabase → Edge Functions → Secrets, cargá una sola
 * vez para toda la app:
 *   DRIVE_SCRIPT_URL = la URL de este script (termina en /exec)
 *   DRIVE_ADMIN_KEY  = la misma ADMIN_KEY
 *   DRIVE_FOLDER     = (opcional) link de la carpeta principal
 * y publicá la función drive-admin. El panel no pide ninguna clave. Sin
 * ADMIN_KEY el script sigue recibiendo fotos pero no deja listarlas ni borrarlas.
 *
 * Álbum del muro de fotos ("Enviar álbum a Drive" en el panel del evento):
 * usa la misma ADMIN_KEY. La primera vez que actualizás el script con esta
 * versión, Google pide un permiso nuevo ("Conectarse a un servicio externo"):
 * es para descargar las fotos del muro y guardarlas en la carpeta del evento.
 */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action) return json(admin(body));
    // Sin carpeta indicada se usa (o se crea) "EventPix Kiosco" en Mi unidad
    var root;
    if (body.folderId) {
      root = DriveApp.getFolderById(body.folderId);
    } else {
      var def = DriveApp.getRootFolder().getFoldersByName('EventPix Kiosco');
      root = def.hasNext() ? def.next() : DriveApp.getRootFolder().createFolder('EventPix Kiosco');
    }
    var folder = root;
    if (body.folder) {
      var found = root.getFoldersByName(body.folder);
      folder = found.hasNext() ? found.next() : root.createFolder(body.folder);
    }
    // Prueba de conexión: devuelve los links de la carpeta principal y la del evento
    if (body.test) {
      return json({ ok: true, folder: root.getName(), url: root.getUrl(), eventFolder: folder.getName(), eventUrl: folder.getUrl() });
    }
    // Si ya está (reintento), no se duplica
    var existing = folder.getFilesByName(body.name);
    var file;
    if (existing.hasNext()) {
      file = existing.next();
    } else {
      var blob = Utilities.newBlob(Utilities.base64Decode(body.data), body.type || 'image/jpeg', body.name);
      file = folder.createFile(blob);
    }
    // Para el QR: la foto se puede ver con el link (solo esa foto, no la carpeta)
    if (body.share) file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return json({ ok: true, id: file.getId() });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// ─── Panel admin: listar y borrar (con ADMIN_KEY) ─────────────────────

function rootFolder(folderId) {
  if (folderId) return DriveApp.getFolderById(folderId);
  var def = DriveApp.getRootFolder().getFoldersByName('EventPix Kiosco');
  if (!def.hasNext()) throw new Error('Todavía no hay fotos: falta la carpeta "EventPix Kiosco"');
  return def.next();
}

function admin(body) {
  var key = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if (!key) return { ok: false, error: 'Falta configurar ADMIN_KEY en el script (Propiedades del script)' };
  if (body.adminKey !== key) return { ok: false, error: 'Clave del panel incorrecta' };
  if (body.action === 'import') return importAlbum(body);
  var root = rootFolder(body.folderId);

  // Carpetas de eventos con la cantidad de fotos
  if (body.action === 'folders') {
    var list = [];
    var it = root.getFolders();
    while (it.hasNext()) {
      var f = it.next();
      var count = 0;
      var files = f.getFiles();
      while (files.hasNext()) { files.next(); count++; }
      list.push({ id: f.getId(), name: f.getName(), url: f.getUrl(), count: count, updated: f.getLastUpdated().getTime() });
    }
    list.sort(function (a, b) { return b.updated - a.updated; });
    return { ok: true, root: root.getName(), rootUrl: root.getUrl(), folders: list };
  }

  // Fotos de un evento, de a páginas, con miniatura
  if (body.action === 'photos') {
    var folder = DriveApp.getFolderById(body.folder);
    if (!isInside(folder, root)) return { ok: false, error: 'Esa carpeta no es del kiosco' };
    var all = [];
    var fit = folder.getFiles();
    while (fit.hasNext()) {
      var file = fit.next();
      all.push({ file: file, created: file.getDateCreated().getTime() });
    }
    all.sort(function (a, b) { return b.created - a.created; });
    var offset = body.offset || 0;
    var limit = Math.min(body.limit || 40, 60);
    var page = all.slice(offset, offset + limit).map(function (x) {
      var thumb = null;
      try {
        var t = x.file.getThumbnail();
        if (t) thumb = 'data:' + (t.getContentType() || 'image/png') + ';base64,' + Utilities.base64Encode(t.getBytes());
      } catch (err) { /* sin miniatura todavía */ }
      return { id: x.file.getId(), name: x.file.getName(), size: x.file.getSize(), created: x.created, url: x.file.getUrl(), thumb: thumb };
    });
    return { ok: true, total: all.length, photos: page };
  }

  // Borrar fotos (van a la papelera de Drive, se pueden recuperar 30 días)
  if (body.action === 'delete') {
    var done = 0;
    (body.ids || []).forEach(function (id) {
      var file = DriveApp.getFileById(id);
      var parents = file.getParents();
      while (parents.hasNext()) {
        if (isInside(parents.next(), root)) { file.setTrashed(true); done++; return; }
      }
    });
    return { ok: true, deleted: done };
  }

  // Borrar la carpeta entera de un evento
  if (body.action === 'deleteFolder') {
    var ev = DriveApp.getFolderById(body.folder);
    if (!isInside(ev, root) || ev.getId() === root.getId()) return { ok: false, error: 'Esa carpeta no es de un evento del kiosco' };
    ev.setTrashed(true);
    return { ok: true };
  }

  return { ok: false, error: 'Acción desconocida: ' + body.action };
}

// ─── Álbum del muro de fotos (con ADMIN_KEY) ──────────────────────────
// El panel manda tandas de { url, name } (links públicos de las fotos y audios
// aprobados) y textos { name, content }. Todo va a la carpeta del evento, la
// misma que usa el kiosco si tiene el mismo nombre. Si un archivo ya está, se
// saltea: se puede reintentar sin duplicar.
function importAlbum(body) {
  var root;
  if (body.folderId) {
    root = DriveApp.getFolderById(body.folderId);
  } else {
    var def = DriveApp.getRootFolder().getFoldersByName('EventPix Kiosco');
    root = def.hasNext() ? def.next() : DriveApp.getRootFolder().createFolder('EventPix Kiosco');
  }
  if (!body.folder) return { ok: false, error: 'Falta el nombre de la carpeta del evento' };
  var found = root.getFoldersByName(body.folder);
  var folder = found.hasNext() ? found.next() : root.createFolder(body.folder);

  var saved = 0, skipped = 0, failed = [], todo = [];
  (body.files || []).forEach(function (f) {
    if (!f || !f.name || !/^https:\/\//.test(f.url || '')) { failed.push((f && f.name) || '?'); return; }
    if (folder.getFilesByName(f.name).hasNext()) { skipped++; return; }
    todo.push(f);
  });
  if (todo.length) {
    var responses = UrlFetchApp.fetchAll(todo.map(function (f) { return { url: f.url, muteHttpExceptions: true }; }));
    responses.forEach(function (res, i) {
      if (res.getResponseCode() === 200) {
        folder.createFile(res.getBlob().setName(todo[i].name));
        saved++;
      } else {
        failed.push(todo[i].name);
      }
    });
  }

  (body.texts || []).forEach(function (t) {
    var existing = folder.getFilesByName(t.name);
    if (existing.hasNext()) existing.next().setContent(t.content);
    else folder.createFile(t.name, t.content, MimeType.PLAIN_TEXT);
  });

  // Para mandarle el link al anfitrión sin que tenga que pedir acceso
  var shared = false;
  if (body.shareFolder) {
    try { folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); shared = true; } catch (err) { /* cuenta que no lo permite */ }
  }
  return { ok: true, folderUrl: folder.getUrl(), saved: saved, skipped: skipped, failed: failed, shared: shared };
}

/** ¿La carpeta es la del kiosco o está adentro (hasta 3 niveles)? */
function isInside(folder, root) {
  var current = [folder];
  for (var level = 0; level < 4 && current.length; level++) {
    var next = [];
    for (var i = 0; i < current.length; i++) {
      if (current[i].getId() === root.getId()) return true;
      var p = current[i].getParents();
      while (p.hasNext()) next.push(p.next());
    }
    current = next;
  }
  return false;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
