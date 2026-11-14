import { useEffect, useState } from 'react';
import { downloadPrinting, listPrintings, markPrinting } from '../services/printing-api.js';

const formatDate = (value) => value && Number.isFinite(new Date(value).getTime())
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value)) : 'Data não informada';

export function PrintingPage({ accessToken }) {
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setResult(null);
    listPrintings(status, page, accessToken, controller.signal).then((data) => {
      if (!controller.signal.aborted) {
        if (!data.records.length && page > 1) setPage(page - 1);
        else setResult(data);
      }
    }).catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [status, page, revision, accessToken]);

  const download = async (record) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const { url } = await downloadPrinting(record.id, accessToken);
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) throw new Error('Link de download inválido.');
      const anchor = document.createElement('a');
      anchor.href = url; anchor.rel = 'noopener noreferrer'; anchor.target = '_blank';
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setNotice('Download solicitado. Abra o arquivo no computador para imprimir. A solicitação continua pendente até sua confirmação.');
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const mark = async (record) => {
    if (!window.confirm(`Confirma que o documento de ${record.nome || record.numero || 'solicitante não informado'} já foi impresso fisicamente?`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await markPrinting(record.id, accessToken);
      setNotice('Solicitação marcada como impressa. Consulte-a no histórico.');
      setRevision((value) => value + 1);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  return <div className="page-stack">
    <section className="page-intro"><p className="eyebrow">Documentos confirmados pelo chatbot</p><h2>Gerenciamento de Impressões</h2><p>Baixe os documentos, imprima pelo computador e confirme a conclusão para mover o pedido ao histórico.</p></section>
    <section className="panel-card page-stack" aria-label="Solicitações de impressão">
      <div className="printing-toolbar"><div className="printing-tabs" aria-label="Filtrar solicitações">
        {[['pending', 'Pendentes'], ['printed', 'Histórico']].map(([key, label]) => <button key={key} type="button" className="secondary-button" aria-pressed={status === key} disabled={busy} onClick={() => { setStatus(key); setPage(1); setNotice(''); }}>{label}</button>)}
      </div><button type="button" className="secondary-button" disabled={loading || busy} onClick={() => setRevision((value) => value + 1)}>Atualizar lista</button></div>
      {error && <p className="feedback feedback--error" role="alert">{error}</p>}
      {notice && <p className="overview-note" role="status">{notice}</p>}
      {loading ? <p role="status">Carregando solicitações…</p> : result && <>
        <p className="helper-text">{result.total} solicitações {status === 'pending' ? 'pendentes · mais antigas primeiro' : 'impressas · mais recentes primeiro'}. Horário de Brasília.</p>
        {!result.records.length ? <div className="empty-state"><strong>{status === 'pending' ? 'Nenhuma impressão pendente.' : 'Nenhuma impressão no histórico.'}</strong><p>Use Atualizar lista para consultar novos pedidos.</p></div> : <div className="printing-table-wrap"><table className="printing-table"><thead><tr><th scope="col">Solicitante</th><th scope="col">Solicitado em</th><th scope="col">Documento</th><th scope="col">Situação</th><th scope="col">Ações</th></tr></thead><tbody>
          {result.records.map((record) => <tr key={record.id}><td><strong>{record.nome || 'Nome não informado'}</strong><span>{record.numero || 'Número não informado'}</span></td><td>{formatDate(record.data)}</td><td>{record.nome_arquivo || 'Documento sem nome'}<span>{record.tipo_arquivo || 'Tipo não informado'}</span>{!record.hasFile && <span>Arquivo não informado</span>}</td><td>{record.impresso ? 'Impresso' : 'Pendente'}</td><td><div className="printing-actions"><button type="button" className="secondary-button" disabled={busy || !record.hasFile} onClick={() => download(record)}>Baixar arquivo</button>{!record.impresso && <button type="button" className="primary-button" disabled={busy} onClick={() => mark(record)}>Marcar como impresso</button>}</div></td></tr>)}
        </tbody></table></div>}
        <div className="printing-toolbar"><button type="button" className="secondary-button" disabled={busy || page === 1} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page} de {Math.max(1, Math.ceil(result.total / result.pageSize))}</span><button type="button" className="secondary-button" disabled={busy || page * result.pageSize >= result.total} onClick={() => setPage(page + 1)}>Próxima</button></div>
      </>}
    </section>
  </div>;
}
