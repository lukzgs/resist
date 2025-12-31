import { useTranslation } from '../i18n';

export default function LanguageSelector() {
    const { language, setLanguage } = useTranslation();

    return (
        <div className="fixed top-4 right-4 z-50">
            <div className="flex gap-1 bg-black/60 backdrop-blur-md rounded-lg p-1 border border-white/10">
                <button
                    onClick={() => setLanguage('pt')}
                    className={`px-2 py-1 rounded font-mono text-xs transition-all ${language === 'pt'
                            ? 'bg-resistance text-black font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                >
                    PT
                </button>
                <button
                    onClick={() => setLanguage('en')}
                    className={`px-2 py-1 rounded font-mono text-xs transition-all ${language === 'en'
                            ? 'bg-resistance text-black font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                >
                    EN
                </button>
            </div>
        </div>
    );
}
