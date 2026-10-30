// qr.js no trae tipos: lo mínimo que usamos (ver lib/qr.ts).
declare module 'qr.js/lib/QRCode' {
    export default class QRCode {
        constructor(typeNumber: number, errorCorrectLevel: number);
        modules: boolean[][];
        addData(data: string): void;
        make(): void;
    }
}

declare module 'qr.js/lib/ErrorCorrectLevel' {
    const levels: { L: number; M: number; Q: number; H: number };
    export default levels;
}
