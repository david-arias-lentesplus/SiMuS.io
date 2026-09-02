# 0002 — Supabase como persistencia central

- Estado: Aceptado
- Fecha: 2026-09-01

## Contexto
Workingbits, el proveedor y gateway de envío de SMS, retiene los registros de envío solo por 90 días. El objetivo del proyecto exige trazabilidad permanente de cada mensaje enviado, por lo que depender únicamente de Workingbits como fuente de datos históricos es inviable.

## Decisión
Se usa Supabase como base de datos central del proyecto. El agente Iris extrae los registros de envío/entrega de Workingbits antes de que expiren y los entrega al agente Deméter, quien los persiste de forma permanente en Supabase junto con los datos de clientes sincronizados desde HubSpot (vía Hermes).

## Consecuencias
- La ventana de 90 días de Workingbits pasa a ser una restricción operativa sobre la frecuencia/oportunidad de extracción de Iris, no una limitación del sistema en su conjunto.
- Deméter se convierte en la única fuente de verdad de datos estructurados; ningún otro agente persiste datos por su cuenta.
- Se requiere definir un mecanismo de extracción confiable (webhook o polling) — ver "Pendiente de definir" en `.claude/agents/iris.md`.

## Alternativas consideradas
- Depender de la API de Workingbits como fuente de consulta histórica bajo demanda: descartado porque los datos más antiguos de 90 días simplemente dejan de estar disponibles.
- Otras bases de datos gestionadas: no se evaluaron alternativas en detalle porque Supabase fue un requisito explícito del usuario al definir el proyecto.
