import { useTranslation } from '../i18n';

export default function LanguageSelector() {
    const { language, setLanguage } = useTranslation();

    const toggleLanguage = () => {
        setLanguage(language === 'pt' ? 'en' : 'pt');
    };

    return (
        <div className="fixed top-4 right-4 z-50">
            <button
                onClick={toggleLanguage}
                className="relative flex items-center bg-black/60 backdrop-blur-md rounded-full p-0.5 border border-white/10 cursor-pointer w-16 h-7"
            >
                {/* Sliding indicator */}
                <div
                    className={`absolute w-7 h-6 bg-resistance rounded-full transition-all duration-300 ease-out ${language === 'pt' ? 'left-0.5' : 'left-[calc(100%-1.875rem)]'
                        }`}
                />
                <span className={`relative z-10 w-1/2 text-center font-mono text-xs transition-colors duration-300 ${language === 'pt' ? 'text-black font-bold' : 'text-slate-400'
                    }`}>
                    PT
                </span>
                <span className={`relative z-10 w-1/2 text-center font-mono text-xs transition-colors duration-300 ${language === 'en' ? 'text-black font-bold' : 'text-slate-400'
                    }`}>
                    EN
                </span>
            </button>
        </div>
    );
}
