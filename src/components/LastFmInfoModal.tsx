import { motion, AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onClose: () => void;
  accentColor: string;
}

export default function LastFmInfoModal({ open, onClose, accentColor }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-md w-full rounded-2xl bg-[#12121a] ring-1 ring-white/10 p-6 shadow-2xl"
          >
            <h2 className="text-lg font-bold text-white mb-3">How it works</h2>

            <div className="flex flex-col gap-3 text-sm text-white/60 leading-relaxed">
              <p>
                <strong className="text-white/80">Last.fm</strong> is a free
                service that tracks every song you listen to across all your
                music apps. It's been around since 2002 and works with Spotify,
                Apple Music, Tidal, and more.
              </p>

              <div className="rounded-xl bg-white/5 p-4 flex flex-col gap-2">
                <p className="text-white/70 font-medium text-xs uppercase tracking-wider">
                  Quick setup
                </p>
                <ol className="list-decimal list-inside flex flex-col gap-1.5 text-white/50 text-[13px]">
                  <li>
                    Create a free account at{" "}
                    <a
                      href="https://www.last.fm/join"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: accentColor }}
                      className="hover:underline"
                    >
                      last.fm/join
                    </a>
                  </li>
                  <li>
                    Go to{" "}
                    <a
                      href="https://www.last.fm/settings/applications"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: accentColor }}
                      className="hover:underline"
                    >
                      Settings &rarr; Applications
                    </a>{" "}
                    and connect your music service (Spotify, Apple Music, etc.)
                  </li>
                  <li>Listen to some music so it starts tracking</li>
                  <li>Come back here and enter your Last.fm username</li>
                </ol>
              </div>

              <p className="text-white/40 text-xs">
                This site only reads your public listening data - no passwords,
                no login required. Your Last.fm profile is public by default, so
                all this site needs is your username.
              </p>
            </div>

            <button
              onClick={onClose}
              className="mt-5 w-full py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
              style={{
                backgroundColor: `${accentColor}15`,
                color: `${accentColor}cc`,
                borderWidth: 1,
                borderColor: `${accentColor}25`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${accentColor}25`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = `${accentColor}15`;
              }}
            >
              got it
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
