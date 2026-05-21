# Go-Live Checklist

## Banco e storage

- aplicar `supabase-schema.sql` no ambiente alvo
- confirmar existência e permissão do bucket `delivery-photos`
- validar índices e constraints das tabelas novas
- criar backup lógico antes da implantação

## Ambiente

- preencher `NEXT_PUBLIC_SUPABASE_URL`
- preencher `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- preencher `SUPABASE_SERVICE_ROLE_KEY`
- preencher `EVOLUTION_BASE_URL`
- preencher `EVOLUTION_API_KEY`
- preencher `EVOLUTION_INSTANCE`
- preencher `EVOLUTION_WEBHOOK_SECRET` e configurar a Evolution para chamar `/api/evolution/status`
- preencher `RESEND_API_KEY`
- preencher `EMAIL_FROM`

## Operação

- executar `npm run lint`
- executar `npm run test`
- executar `npm run build`
- abrir `/setup` se não existir operador inicial
- validar login do operador
- validar troca de condomínio autorizada
- validar cadastro de morador e encomenda
- validar envio de notificação
- validar envio de e-mail para morador com e-mail cadastrado
- validar envio de WhatsApp com foto quando a encomenda tiver foto
- validar geração do QR
- validar leitura e retirada por QR
- validar foto opcional na retirada manual e por QR
- validar retirada agrupada por unidade
- validar exportação CSV e Excel em `/relatorios`

## Rollback

- em caso de falha no QR, manter retirada manual pela home
- em caso de falha na Evolution, manter cadastro e fila operando sem bloquear retirada
- não remover tabelas nem auditorias durante rollback
