import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import LanguageSelector from '../../components/LanguageSelector';
import { I18nProvider } from '../../i18n';

describe('LanguageSelector', () => {
    const renderWithContext = () => {
        return render(
            <I18nProvider>
                <LanguageSelector />
            </I18nProvider>
        );
    };

    it('renderiza o botão de alternar idioma corretamente', () => {
        renderWithContext();
        
        // React Testing Library verifica se a interface apresenta o que esperamos ao usuário
        expect(screen.getByText('PT')).toBeInTheDocument();
        expect(screen.getByText('EN')).toBeInTheDocument();
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('responde aos cliques do usuário sem quebrar', async () => {
        renderWithContext();
        const user = userEvent.setup();
        const button = screen.getByRole('button');
        
        // Simulando a interação real de um usuário clicando
        await user.click(button);
        
        // Verifica se a interface continuou íntegra
        expect(screen.getByText('EN')).toBeInTheDocument();
    });
});
