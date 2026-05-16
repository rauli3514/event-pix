const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PORT = 3001;

// 1. Detectar impresoras instaladas en el sistema
app.get('/printers', (req, res) => {
    // Comando para Windows (WMIC) o Mac/Linux (LPSTAT)
    const cmd = process.platform === 'win32' 
        ? 'wmic printer get name' 
        : 'lpstat -a | cut -f1 -d" "';

    exec(cmd, (err, stdout) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const printers = stdout.split('\n')
            .map(s => s.trim())
            .filter(s => s && s !== 'Name' && !s.includes('----------'));
        
        res.json({ printers });
    });
});

// 2. Recibir comando de impresión desde la web
app.post('/print', async (req, res) => {
    const { imageUrl, printerName, copies = 1 } = req.body;
    
    if (!imageUrl) return res.status(400).json({ error: 'Falta la imagen' });

    console.log(`🖨️ Imprimiendo en: ${printerName || 'Predeterminada'} (${copies} copias)`);

    try {
        // Descargar la imagen a un archivo temporal
        const tempPath = path.join(__dirname, `temp_print_${Date.now()}.jpg`);
        const response = await axios({
            url: imageUrl,
            responseType: 'stream',
        });

        const writer = fs.createWriteStream(tempPath);
        response.data.pipe(writer);

        writer.on('finish', () => {
            // Comando de impresión silenciosa según el sistema
            let printCmd;
            if (process.platform === 'win32') {
                // Usamos PowerShell para imprimir en Windows sin diálogos
                const printerArg = printerName ? `-PrinterName "${printerName}"` : '';
                printCmd = `powershell -Command "Start-Process -FilePath '${tempPath}' -Verb PrintTo ${printerArg} -PassThru | %{ sleep 2; $_.Kill() }"`;
                
                // Opción B más robusta (System.Drawing):
                const ps = `Add-Type -AssemblyName System.Drawing; $doc = New-Object System.Drawing.Printing.PrintDocument; ${printerName ? `$doc.PrinterSettings.PrinterName = '${printerName}';` : ''} $doc.add_PrintPage({ param($s, $e); $img = [System.Drawing.Image]::FromFile('${tempPath.replace(/\\/g, '/')}'); $e.Graphics.DrawImage($img, 0, 0, $e.PageBounds.Width, $e.PageBounds.Height); $img.Dispose(); }); $doc.Print();`;
                printCmd = `powershell -Command "${ps}"`;
            } else {
                // Comando para Mac/Linux
                const printerArg = printerName ? `-d "${printerName}"` : '';
                printCmd = `lp ${printerArg} -n ${copies} "${tempPath}"`;
            }

            exec(printCmd, (printErr) => {
                // Borrar archivo temporal después de un momento
                setTimeout(() => { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); }, 5000);
                
                if (printErr) {
                    console.error('Error al imprimir:', printErr);
                    return res.status(500).json({ error: 'Error al enviar a la impresora' });
                }
                res.json({ success: true });
            });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`
    =============================================
    🚀 SERVIDOR DE IMPRESIÓN EVENTPIX ACTIVO
    =============================================
    Puerto: ${PORT}
    Estado: Esperando peticiones de la web...
    
    Instrucciones:
    1. Mantén esta ventana abierta.
    2. En tu web, ve a "Ajustes de Impresión".
    3. ¡Tu impresora debería aparecer ahora!
    =============================================
    `);
});
