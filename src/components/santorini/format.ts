// Dates on the Santorini pages. The time zone is fixed so that the server's
// render and the browser's agree (most players are in Brazil).
const dateTime = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
})

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))
