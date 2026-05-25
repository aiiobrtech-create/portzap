# Go-Live Checklist

## Banco e storage

- aplicar `supabase-schema.sql` no ambiente alvo
- confirmar existência e permissão do bucket configurado em `SUPABASE_DELIVERY_PHOTOS_BUCKET` ou usar o padrão `delivery-photos`
- validar índices e constraints das tabelas novas
- criar backup lógico antes da implantação

## Ambiente

- preencher `NEXT_PUBLIC_SUPABASE_URL`
- preencher `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- preencher `SUPABASE_SERVICE_ROLE_KEY`
- preencher `EVOLUTION_BASE_URL` com a raiz da API Evolution, por exemplo `https://seu-dominio-ou-proxy`
- preencher `EVOLUTION_API_KEY`
- preencher `EVOLUTION_INSTANCE`
- preencher `EVOLUTION_WEBHOOK_SECRET` se quiser validar o webhook de status
- configurar a Evolution para chamar `POST /api/evolution/status` neste app

## Operação

- executar `npm run lint`
- executar `npm run test`
- executar `npm run build`
- abrir `/setup` se não existir operador inicial
- validar login do operador
- validar troca de condomínio autorizada
- validar cadastro de morador e encomenda
- validar envio de notificação
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
