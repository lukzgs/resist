
import React from 'react';
import { useTranslation } from '../i18n';

interface Props {
  mode: 'CREATE' | 'JOIN';
  playerName: string;
  onNameChange: (n: string) => void;
  onInit: () => void;
  onJoin: (code: string) => void;
  onBack: () => void;
  prefillCode?: string | null;
}

export default function SetupView({ mode, playerName, onNameChange, onInit, onJoin, onBack, prefillCode }: Props) {
  const { t } = useTranslation();
  const [code, setCode] = React.useState(prefillCode || '');
  const isJoin = mode === 'JOIN';
  const hasPrefilledCode = !!prefillCode;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <div className="w-full max-w-md bg-black/60 backdrop-blur-3xl p-10 rounded-[40px] border border-white/10 shadow-2xl relative overflow-hidden view-enter">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-resistance/50 to-transparent"></div>

        <h2 className="text-3xl font-display font-black text-white mb-8 uppercase tracking-[0.2em] text-center italic">
          {isJoin ? t('setup.join.title') : t('setup.create.title')}
        </h2>

        <div className="space-y-8">
          <div className="space-y-2">
            <label className="text-sm font-mono text-slate-300 uppercase tracking-widest ml-4">{t('setup.name')}</label>
            <input
              type="text"
              value={playerName}
              onChange={e => onNameChange(e.target.value)}
              className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-white outline-none focus:border-resistance transition-all font-mono text-xl"
              placeholder={t('setup.name.placeholder')}
            />
          </div>

          {isJoin && (
            <div className="space-y-2">
              <label className="text-sm font-mono text-slate-300 uppercase tracking-widest ml-4">
                {t('setup.code')} {hasPrefilledCode && <span className="text-resistance">{t('setup.code.via_link')}</span>}
              </label>
              <input
                type="text"
                maxLength={4}
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                readOnly={hasPrefilledCode}
                className={`w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-white outline-none text-center text-5xl font-display tracking-[0.5em] transition-all ${hasPrefilledCode ? 'bg-resistance/10 border-resistance/30' : 'focus:border-resistance'}`}
                placeholder="0000"
              />
            </div>
          )}

          <div className="pt-4 space-y-4">
            <button
              onClick={() => isJoin ? onJoin(code) : onInit()}
              className="btn-animate w-full bg-resistance text-black py-5 rounded-2xl font-display font-black text-2xl shadow-glow-blue uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all"
            >
              {isJoin ? t('setup.join.button') : t('setup.create.button')}
            </button>
            <button
              onClick={onBack}
              className="btn-animate w-full text-slate-300 text-sm uppercase font-bold tracking-[0.3em] hover:text-white transition-colors"
            >
              {t('setup.back')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

