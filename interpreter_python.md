Ejecución automática de código Python (Piston) — Fase 1

Contexto

El profesor usa este torneo para dos materias: Fundamentos de Computación
(PSeInt) y Estructura de Datos (Python). Hoy el "veredicto" es 100% manual
— el profesor lee el texto de la submission y aprueba/rechaza a ojo. Para
el grupo de Python, la idea es que la plataforma pueda ejecutar el
código real contra casos de prueba (entrada→salida esperada) definidos
por el profesor al crear cada caso, y mostrar el resultado (qué pasó, qué
no) tanto al equipo como al profesor — sin quitarle al profesor la
decisión final de aprobar/rechazar.

Se investigó y descartó (con el usuario) intentar reusar sitios como
pseint-web.app como "backend" — no exponen API, son apps client-side.
También se investigaron reimplementaciones de PSeInt en JS
(daniel11v/PSeInt-Web, JoshuaLeonK/pseint): ambas demasiado
incompletas/inmaduras para copiar tal cual (una sin licencia declarada,
la otra con 1 commit). Se acordó explícitamente diferir PSeInt como
investigación aparte y enfocar este incremento solo en Python, usando
Piston (motor de ejecución de código open source, sandboxed,
self-hostable, API pública en emkc.org/api/v2/piston para arrancar sin
infraestructura propia).

El idioma es una propiedad del torneo completo, no por caso (decisión
explícita del usuario — cada torneo = un curso = un lenguaje).

Diseño explorado con un agente de investigación (flujo real de
submission/veredicto, confirmado socket-based no REST) + una pasada de
validación de arquitectura que encontró una condición de carrera real
en el diseño inicial (ver sección de persistencia abajo) — ya corregida.

Diseño

1. Esquema (3 columnas nuevas, patrón ALTER TABLE ya establecido)

- tournaments.language TEXT NOT NULL DEFAULT 'PSEINT' (torneos
existentes no cambian de comportamiento).
- business_cases.test_cases_json TEXT NOT NULL DEFAULT '[]' (array de
{input, expectedOutput}).
- submissions.execution_result_json TEXT (nullable; null = nunca se
ejecutó, distinto de status: 'ERROR' = se intentó y Piston falló).

business_cases tiene dos rutas de escritura que deben tocarse en
lockstep (hallazgo de la validación): SqliteBusinessCaseRepository.save()
(ON CONFLICT DO UPDATE, usada por StartTournamentUseCase) y
SqliteTournamentRepository's upsertBusinessCaseRow (ON CONFLICT DO NOTHING, se ejecuta en cada save del agregado pero es no-op tras la
creación). Ambas comparten BusinessCaseMapper.toRow(), así que agregar
test_cases_json ahí basta — pero hay que actualizar el INSERT SQL de
ambos repositorios.

2. Dominio

- Tournament: nuevo campo language: 'PYTHON' | 'PSEINT' +
getLanguage() + setLanguage() (llamado una vez desde
StartTournamentUseCase, igual que ya hace setPendingCaseIds()).
Incluir en rehydrate().
- BusinessCase: nuevo campo testCases: {input: string; expectedOutput: string}[], readonly, solo por constructor — la entidad
se mantiene 100% inmutable (confirmado que no rompe nada, ver arriba).
- Submission: nuevo campo executionResult: ExecutionResult | null
(default null), con un setExecutionResult(result) — es una
anotación de canal lateral, no pasa por approve()/reject() ni afecta
el estado de veredicto.

interface TestCaseExecutionResult { input: string; expectedOutput: string; actualOutput: string; passed: boolean; }
interface ExecutionResult { status: 'RAN' | 'ERROR'; testResults: TestCaseExecutionResult[]; stderr: string | null; }

3. Puerto + adaptador Piston (primera llamada HTTP saliente del backend)

- src/application/ports/code-runner.ts: CodeRunner.run({language, code, stdin}): Promise<{stdout, stderr, exitCode, timedOut}> — nunca lanza;
errores de red/timeout se normalizan en el resultado, no en una
excepción, para que los casos de uso no necesiten try/catch de red.
- src/infrastructure/piston/piston-code-runner.ts: fetch nativo
(Node 24, sin dependencia nueva) a POST {PISTON_URL ?? 'https://emkc.org/api/v2/piston'}/api/v2/execute, con
signal: AbortSignal.timeout(10_000) (hallazgo de la validación: sin
timeout, un Piston caído cuelga la request indefinidamente). Resuelve
la versión de Python vía GET /api/v2/runtimes una vez (cacheada en
memoria del proceso) en vez de hardcodear una versión — Piston rechaza
pares lenguaje/versión que no coincidan exactamente.
- Nota de producción, no bloqueante para esta fase: la API pública de
Piston tiene rate limits pensados para uso ligero, no para una clase
completa enviando código en simultáneo. Queda documentado que
auto-hospedar Piston (Docker) es el paso natural antes de usar esto en
una clase real — el PISTON_URL configurable ya lo deja listo sin
tocar código.

4. Persistencia — el hallazgo importante de la validación

No usar tournamentRepository.save(tournament) para guardar el
resultado de ejecución. SqliteTournamentRepository.save() hace
read-modify-write del agregado completo: por cada match, borra y
reinserta TODAS sus submissions desde el array en memoria
(replaceSubmissions). Si RunSubmissionCodeUseCase carga el torneo,
espera la respuesta de Piston (segundos), y luego guarda ese objeto ya
desactualizado, borra silenciosamente la submission del equipo rival
si este envió la suya mientras tanto — nada raro en un match real donde
ambos equipos suelen enviar casi al mismo tiempo.

Fix: nuevo método angosto en el puerto y su implementación SQLite:
updateSubmissionExecutionResult(submissionId, result): Promise<void> →
un solo UPDATE submissions SET execution_result_json = ? WHERE id = ?.
Sin read-modify-write de agregado, sin condición de carrera posible.

5. Dos casos de uso nuevos

1. TestCodeUseCase ("Probar código", sin persistir): busca el match
y su BusinessCase (mismo patrón que SubmitMatchSolutionUseCase,
solo lectura), exige match.getStatus() === 'ACTIVE' (si no, error —
evita que se sondeen los casos de prueba de un match ya cerrado),
corre el código del equipo contra cada test case (stdin = input),
compara actualOutput.trim() === expectedOutput.trim(), devuelve el
detalle completo (incluye expected/actual en fallos — el valor
pedagógico de ver el diff pesa más que ocultarlo; la protección real
contra "hardcodear la respuesta" es exigir ≥2 test cases con inputs
distintos, no la opacidad).
2. RunSubmissionCodeUseCase: misma lógica de ejecución+comparación,
pero guardada vía updateSubmissionExecutionResult(). Se dispara
fire-and-forget desde TeamGateway.handleSubmitSolution después
de emitir submission_accepted (nunca bloquea ni puede tumbar la
submission real si Piston falla) — con .catch() explícito (hallazgo
de la validación: una promesa fire-and-forget sin catch puede tumbar
el proceso por unhandledRejection). Al resolver (éxito o ERROR por
timeout/fallo), guarda el resultado y emite otro match_updated para
que JudgePage/TeamMatchPage refresquen.

Ambos casos de uso se saltan por completo si tournament.getLanguage() !== 'PYTHON' — cero cambio de comportamiento para torneos PSeInt.

6. StartTournamentUseCase

- StartTournamentInput gana language: 'PYTHON' | 'PSEINT' (top-level,
todo el torneo).
- Cada StartTournamentCaseInput gana testCases?: {input, expectedOutput}[].
- Validación: si language === 'PYTHON', cada caso exige
testCases.length >= 2 (no >=1 — con un solo caso de prueba, un
equipo podría hardcodear la salida esperada sin resolver nada; con 2+
inputs distintos ya no alcanza con eso). Si language === 'PSEINT',
sin exigencia (comportamiento actual, sin cambios).

7. HTTP

- Nuevo POST /matches/:matchId/run (público, mismo nivel de confianza
que submit_solution) → TestCodeUseCase. Body {teamId, code}.
- MatchesController.getById() (usada por TeamMatchPage): agregar
language: tournament.getLanguage() al nivel del match (denormalizado,
el tournament ya se resuelve ahí mismo), y por submission un
resumen, no el detalle completo:
executionSummary: {status, testsPassed, testsTotal} | null — nunca
el actual/expected/stderr, para no filtrarle al equipo rival el stdout
del otro (este endpoint es público y hoy YA es deliberadamente mínimo:
no expone content, solo {teamId, verdict} — se sigue el mismo
patrón).
- TournamentPresenter.presentSubmission() (usada por GET /tournaments/:id, que alimenta JudgePage): esta SÍ ya expone
content completo hoy — se le agrega el executionResult completo
(incluye actual/expected/stderr por test case) para que el profesor
tenga contexto real al decidir, consistente con el nivel de detalle que
ese endpoint ya expone.

8. Frontend

- StartTournamentPanel.tsx: selector de idioma (Python/PSeInt) al
tope del modal, antes de las pestañas actuales. Dentro de la pestaña
"Casos", cuando language === 'PYTHON', cada sub-tab de caso gana un
editor de test cases (filas input→expectedOutput, agregar/quitar,
mínimo 2 antes de habilitar "Iniciar torneo"). Con PSeInt, cero cambio
visual (exactamente la UI de hoy).
- TeamMatchPage.tsx: nueva dependencia @uiw/react-codemirror +
@codemirror/lang-python. Cuando match.language === 'PYTHON',
reemplaza el <textarea> por <CodeMirror extensions={[python()]}>;
nuevo botón "Probar código" (llama POST /matches/:matchId/run,
muestra pass/fail + diff por test case, sin límite de usos); "Enviar
solución" sigue disparando el mismo submit_solution de siempre, y una
vez que executionSummary llega (poll/socket existente), se muestra
junto al estado de la submission. PSeInt mantiene el <textarea> plano
de hoy — sin tocar esa ruta en esta fase.
- JudgePage.tsx: badge de resumen pass/fail junto a
submission.content cuando executionResult está presente (solo
informativo — los botones Aprobar/Rechazar y su wiring no cambian en
absoluto).

Verificación

1. npm test en el backend en verde — agregar tests: StartTournamentUseCase
rechaza <2 test cases para Python, acepta 0 para PSeInt;
TestCodeUseCase compara bien (mock del CodeRunner, sin llamar a
Piston real en tests); RunSubmissionCodeUseCase persiste vía el
método angosto sin tocar el resto del agregado (test específico contra
SQLite real en persistence.spec.ts con dos submissions concurrentes
simuladas, confirmando que la segunda no borra la primera).
2. npx tsc -b limpio en frontend tras agregar CodeMirror.
3. Manual end-to-end (backend+frontend corriendo, Playwright): crear un
torneo Python con 4 equipos, 2 test cases por caso; un equipo escribe
código, usa "Probar código" y ve pass/fail; envía solución oficial;
confirmar que el resumen aparece en su vista y el detalle completo
aparece en JudgePage; confirmar que el equipo rival NO ve el
stdout/expected del otro vía GET /matches/:matchId; profesor
aprueba/rechaza manualmente sin que cambie nada del flujo actual.
4. Confirmar que un torneo PSeInt (comportamiento hoy) no se ve afectado
en nada — mismo textarea, mismo flujo, language: 'PSEINT' por
default en torneos ya existentes.
