import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdminLayout } from '../src/components/AdminLayout.jsx';
import { HtmlUpload } from '../src/components/HtmlUpload.jsx';

describe('IARA visual identity and HTML-only import interface', () => {
  it('renders the official logo in the shared administrative layout', () => {
    render(<AdminLayout admin={{ email: 'admin@example.com' }} activeView="overview" onNavigate={() => {}} onLogout={() => {}}><p>Conteúdo</p></AdminLayout>);

    expect(screen.getByAltText('Logo IARA')).toBeInTheDocument();
    expect(screen.queryByText('Backend conectado')).not.toBeInTheDocument();
  });

  it('offers only the structured HTML file format', () => {
    const { container } = render(<HtmlUpload file={null} onFileChange={() => {}} onRemove={() => {}} />);
    expect(screen.getByText('Arraste um arquivo HTML para esta área')).toBeInTheDocument();
    expect(screen.queryByText(/PDF/i)).not.toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).toHaveAttribute('accept', '.html,.htm,text/html');
  });
});
