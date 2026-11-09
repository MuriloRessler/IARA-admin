export function ConnectionStatus({ status }) {
  const labels = {
    loading: 'Verificando conexão...',
    connected: 'Backend conectado',
    error: 'Não foi possível conectar ao backend',
  };

  return (
    <div className={`connection-status connection-status--${status}`} role="status">
      <span className="connection-status__dot" aria-hidden="true" />
      {labels[status]}
    </div>
  );
}
