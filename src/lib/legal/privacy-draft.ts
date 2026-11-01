/**
 * Borrador sugerido de política de privacidad. Describe lo que esta plataforma
 * realmente recoge y hace con los datos. NO se publica solo: el dueño lo revisa
 * (idealmente con asesoría legal), completa los datos de la empresa y lo publica.
 */
export function privacyDraft(business: { name: string; email: string | null; whatsapp: string | null; address: string | null }) {
  const contact = [business.whatsapp && `WhatsApp: +${business.whatsapp}`, business.email && `correo: ${business.email}`].filter(Boolean).join(" o ") || "[completar medio de contacto]";
  return `POLÍTICA DE PRIVACIDAD — ${business.name}

[Revisa este borrador y completa los datos entre corchetes antes de publicarlo.]

1. Responsable
${business.name}, [razón social y RNC], con domicilio en ${business.address || "[dirección]"}, República Dominicana, es responsable de los datos personales que recibe a través de este sitio, conforme a la Ley n.º 172-13 sobre protección de datos de carácter personal.

2. Datos que recogemos
- Al hacer un pedido: nombre completo, número de WhatsApp, fecha requerida, observaciones, archivos de diseño o de referencia y el comprobante de transferencia.
- Al solicitar una cotización: nombre, WhatsApp, detalles del trabajo y archivos de referencia.
No pedimos crear cuentas ni solicitamos datos de tarjetas. No recogemos números de cuenta del cliente; el comprobante puede mostrar datos de la transferencia.

3. Para qué los usamos
- Preparar, producir y entregar tu pedido o cotización.
- Verificar tu pago por transferencia.
- Comunicarnos contigo por WhatsApp sobre tu pedido.
- Cumplir obligaciones contables y legales.
No vendemos ni cedemos tus datos a terceros con fines publicitarios.

4. Dónde se guardan
Los datos y archivos se almacenan en servicios de infraestructura en la nube (Supabase), con acceso restringido al personal autorizado. Los comprobantes y archivos se guardan en almacenamiento privado y solo se consultan mediante enlaces temporales.

5. Cuánto tiempo
Conservamos los datos del pedido el tiempo necesario para atenderlo y el que exijan las normas contables y fiscales [indicar plazo]. Los archivos de diseño pueden eliminarse antes si lo solicitas, salvo que sean necesarios para un pedido en curso.

6. Tus derechos
Puedes solicitar acceso, rectificación, cancelación u oposición al tratamiento de tus datos escribiéndonos por ${contact}. Responderemos en el plazo que establece la ley.

7. Cookies y almacenamiento del navegador
El sitio guarda en tu propio navegador tu carrito y tu preferencia de modo claro u oscuro. No usamos cookies de publicidad ni de seguimiento de terceros.

8. Cambios
Podemos actualizar esta política. La versión vigente estará siempre publicada en esta página con su fecha de actualización.`;
}
