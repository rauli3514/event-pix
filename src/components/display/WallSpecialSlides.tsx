import { motion } from "framer-motion";
import { Submission } from "@/types";
import { RankRow } from "@/lib/wallStats";

// Diapositivas especiales que el carrusel intercala cada tanto entre las fotos:
// un collage con muchas fotos juntas y el ranking de quién subió más.

const TILT = [-3, 2, -1.5, 3, -2, 1.5, -2.5, 2.5, -1, 1, -3, 2];

export const CollageSlide = ({ photos, total }: { photos: Submission[]; total: number }) => (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-[3vw] pt-[17vh] pb-[12vh] portrait:pt-[28vh]">
        <motion.h2
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-[3vh] text-center text-[5vh] font-extrabold drop-shadow-xl portrait:text-[3.2vh]"
        >
            📸 Así viene la noche · {total} fotos
        </motion.h2>
        <div className="grid min-h-0 w-full max-w-[92vw] flex-1 grid-cols-4 grid-rows-3 gap-[1.6vh] portrait:grid-cols-3 portrait:grid-rows-4">
            {photos.map((p, i) => (
                <motion.div
                    key={p.id}
                    initial={{ scale: 0.4, opacity: 0, rotate: 0 }}
                    animate={{ scale: 1, opacity: 1, rotate: TILT[i % TILT.length] }}
                    transition={{ delay: i * 0.12, type: "spring", stiffness: 140, damping: 14 }}
                    className="min-h-0 overflow-hidden rounded-xl border-[0.6vh] border-white bg-white shadow-2xl"
                >
                    <img src={p.content} alt="" className="h-full w-full object-cover" loading="lazy" />
                </motion.div>
            ))}
        </div>
    </div>
);

const MEDALS = ['🥇', '🥈', '🥉', '4°', '5°'];

export const RankingSlide = ({ rows }: { rows: RankRow[] }) => (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-[6vw] pt-[15vh] pb-[6vh] portrait:pt-[28vh]">
        <motion.h2
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-center text-[5.5vh] font-extrabold drop-shadow-xl portrait:text-[3.4vh]"
        >
            🏆 Los que más fotos subieron
        </motion.h2>
        <p className="mb-[4vh] mt-[1vh] text-[2.6vh] text-white/80">¿Quién se queda con el primer puesto?</p>
        <div className="flex w-full max-w-[min(90vw,110vh)] flex-col gap-[1.8vh]">
            {rows.map((r, i) => (
                <motion.div
                    key={r.name}
                    initial={{ x: -80, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.2 + i * 0.25, type: "spring", stiffness: 120, damping: 15 }}
                    className={`flex items-center gap-[2.5vh] rounded-[2vh] border px-[3vh] py-[1.5vh] backdrop-blur-xl ${
                        i === 0
                            ? 'border-yellow-300/60 bg-gradient-to-r from-yellow-500/40 to-amber-600/30'
                            : 'border-white/15 bg-black/40'
                    }`}
                >
                    <span className="w-[6vh] text-center text-[4.5vh] font-extrabold">{MEDALS[i]}</span>
                    <img src={r.thumb} alt="" className="h-[8vh] w-[8vh] rounded-full border-[0.4vh] border-white object-cover" />
                    <span className="flex-1 truncate text-[4vh] font-bold">{r.name}</span>
                    <span className="text-[4vh] font-extrabold tabular-nums">
                        {r.count} <span className="text-[2.6vh] font-semibold text-white/80">{r.count === 1 ? 'foto' : 'fotos'}</span>
                    </span>
                </motion.div>
            ))}
        </div>
    </div>
);
