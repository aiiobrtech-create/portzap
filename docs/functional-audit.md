# Auditoria Funcional

## Estado atual

| Fluxo | Estado | Evidência |
| --- | --- | --- |
| Autenticação do operador | Implementado com Supabase Auth | `app/login/page.tsx`, `app/definir-senha/page.tsx`, `app/security-actions.ts`, `proxy.ts` |
| Vínculo operador-condomínio | Implementado com regra de um condomínio por operador | `lib/operator-auth.ts`, `supabase-schema.sql` |
| Seleção de condomínio | Implementado | `app/sidebar-nav.tsx`, `app/security-actions.ts` |
| Cadastro de condomínio | Implementado | `app/configuracoes/page.tsx`, `app/actions.ts` |
| Cadastro de unidades | Implementado | `app/moradores/page.tsx`, `app/actions.ts` |
| Cadastro de moradores | Implementado | `app/moradores/page.tsx`, `app/actions.ts` |
| Cadastro de encomenda | Implementado | `app/nova-encomenda/page.tsx`, `app/actions.ts` |
| Notificação ao morador por WhatsApp | Implementado com dependência externa | `app/actions.ts`, `lib/evolution/client.ts` |
| Aviso com foto e QR | Implementado | `app/actions.ts`, `lib/evolution/client.ts` |
| Histórico de status | Implementado | `lib/history.ts`, `app/historico/page.tsx` |
| Tentativas de notificação | Implementado | `lib/notifications.ts`, `app/historico/page.tsx` |
| Status enviado/entregue/lido | Implementado via webhook do provedor | `app/api/evolution/status/route.ts`, `lib/notifications.ts` |
| Retirada manual com foto opcional | Implementado | `app/page.tsx`, `app/actions.ts` |
| Retirada por QR com foto opcional | Implementado | `app/retirada/page.tsx`, `app/retirada/scan-panel.tsx`, `app/q/[token]/page.tsx`, `lib/pickup-service.ts` |
| Retirada agrupada por unidade | Implementado | `app/retirada/page.tsx`, `app/actions.ts` |
| Relatórios CSV e Excel | Implementado | `app/relatorios/page.tsx`, `app/api/relatorios/route.ts`, `lib/reporting.ts` |

## Regras críticas validadas

- toda action operacional exige sessão válida
- o condomínio ativo precisa estar dentro da membership única do operador
- QR inválido, expirado, usado ou cancelado não conclui retirada
- falha de notificação não apaga a encomenda cadastrada
- retirada manual invalida QRs ativos daquela encomenda
- retirada agrupada invalida QRs ativos das encomendas da unidade
- cancelamento invalida QRs ativos daquela encomenda

## Pontos de atenção

- a renderização visual do QR usa o serviço externo `api.qrserver.com`
- o envio de aviso depende de `Evolution`
- os status Entregue/Lido dependem do webhook da Evolution apontar para `/api/evolution/status`
- o fluxo de convite/definição de senha usa Supabase Auth
