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
                className="relative flex items-center bg-black backdrop-blur-md rounded-full p-0.5 border border-white/30 cursor-pointer w-20 h-8 hover:border-resistance/50 hover:shadow-[0_0_12px_rgba(34,211,238,0.2)] transition-all duration-300"
            >
                {/* Sliding indicator */}
                <div
                    className={`absolute w-9 h-7 bg-resistance rounded-full transition-all duration-300 ease-out ${language === 'pt' ? 'left-0.5' : 'left-[calc(100%-2.375rem)]'
                        }`}
                />
                <span className={`relative z-10 w-1/2 text-center font-mono text-sm font-bold transition-colors duration-300 ${language === 'pt' ? 'text-black' : 'text-white'
                    }`}>
                    PT
                </span>
                <span className={`relative z-10 w-1/2 text-center font-mono text-sm font-bold transition-colors duration-300 ${language === 'en' ? 'text-black' : 'text-white'
                    }`}>
                    EN
                </span>
            </button>
        </div>
    );
}
