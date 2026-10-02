# CRM Arena Silica

Sistema comercial del banco de arena silica en Lagos de Moreno, Jalisco.

- **App:** https://fondosdharma-a11y.github.io/arena-silica-crm/
- **Base de datos:** Supabase (proyecto `pfsbltkdlnrkodvetfnu`)

## Modulos

| Modulo | Que hace |
|---|---|
| Tablero | Prospectos activos, prioridad 1, potencial por segmento, seguimientos vencidos |
| Prospectos | 65 empresas reales de Jalisco, Guanajuato y Aguascalientes con su zona de flete. Filtros por segmento, estado, estatus y prioridad. Ficha con WhatsApp y llamada directa, bitacora de actividades y siguiente paso |
| Cotizador | Precio de lista por producto + flete automatico por zona, alerta de precio piso, margen bruto en vivo, IVA y cotizacion imprimible |
| Cotizaciones | Historial con folio automatico |
| Catalogo | 20 productos con costo, precio, piso y margen; 9 zonas de flete desde Lagos de Moreno |
| Agenda | Seguimientos por vencer y vencidos, con WhatsApp a un toque |

## Primer uso

Entrar con una cuenta de administrador (correo y contrasena, o el boton de Google). Solo los perfiles con rol `admin` ven el CRM: la seguridad de la base (Row Level Security) deja todo lo comercial detras de `es_interno()`. Los clientes entran por arensil.com/pedidos y solo ven su propia cuenta.

Los administradores salen de la tabla `correos_admin` al registrarse; para cambiar el rol de alguien ya registrado se edita `perfiles.rol`.
