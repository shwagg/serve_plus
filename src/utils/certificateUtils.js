import { PDFDocument } from "pdf-lib";
import QRCode from "qrcode";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { app, db } from "../firebaseConfig";
import { doc, collection, addDoc, serverTimestamp, getDocs } from "firebase/firestore";

export function generateCertificateId() {
  // crypto.randomUUID() is cryptographically secure (CSPRNG-backed), unlike Math.random()
  return crypto.randomUUID();
}

export async function buildCertificateBlob({ recipient, course, date, loc, day, month, year, certId }) {
  const response = await fetch("/assets/SERVE+ Certificate.pdf");
  if (!response.ok) throw new Error("Failed to fetch certificate template PDF.");
  const existingPdfBytes = await response.arrayBuffer();
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const form = pdfDoc.getForm();

  form.getTextField("text_1jfkq").setText(recipient || "");
  form.getTextField("text_2rpme").setText(course || "");
  form.getTextField("text_3ptnr").setText(date || "");
  form.getTextField("text_4kyth").setText(loc || "");
  form.getTextField("text_5nqbl").setText(day || "");
  form.getTextField("text_6iyng").setText(month || "");
  form.getTextField("text_7dgil").setText(year || "");
  form.getTextField("text_10gqgh").setText(certId || "");
  form.flatten();

  const qrValue = JSON.stringify({ recipient, course, date, loc, day, month, year, certificateId: certId });
  const qrDataUrl = await QRCode.toDataURL(qrValue, {
    margin: 1,
    width: 120,
    color: { dark: "#000", light: "#0000" },
  });
  const pngImageBytes = await fetch(qrDataUrl).then((r) => r.arrayBuffer());
  const pngImage = await pdfDoc.embedPng(pngImageBytes);
  const page = pdfDoc.getPages()[0];
  page.drawImage(pngImage, { x: 382, y: 55, width: 90, height: 90 });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
}

/**
 * Generates a certificate PDF and saves it to the volunteer's Firestore + Storage.
 * Upload happens BEFORE addDoc so the onSnapshot listener always sees a complete document
 * (with downloadURL included from the start, no second updateDoc needed).
 */
export async function issueCertificate({ userId, recipient, course, date, loc, day, month, year }) {
  // Idempotency guard — return existing cert if already issued for this recipient+course combo
  const existingSnap = await getDocs(collection(doc(db, "users", userId), "certificates"));
  const duplicate = existingSnap.docs.find(
    d => d.data().course === course && d.data().recipient === recipient
  );
  if (duplicate) {
    const dData = duplicate.data();
    return { certId: dData.certificateId, downloadURL: dData.downloadURL };
  }

  const certId = generateCertificateId();
  const safeRecipient = (recipient || "recipient").replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeCourse = (course || "event").replace(/[^a-zA-Z0-9_-]/g, "_");
  // Include certId in filename to prevent collisions when same recipient retakes a course
  const fileName = `${safeRecipient}_${safeCourse}_${certId}.pdf`;

  // Build and upload first so downloadURL is available before the Firestore doc is created.
  const blob = await buildCertificateBlob({ recipient, course, date, loc, day, month, year, certId });
  const storage = getStorage(app);
  const storageRef = ref(storage, `event-certificates/${userId}/${fileName}`);
  await uploadBytes(storageRef, blob);
  const downloadURL = await getDownloadURL(storageRef);

  await addDoc(collection(doc(db, "users", userId), "certificates"), {
    fileName,
    recipient,
    course,
    date,
    loc,
    day,
    month,
    year,
    certificateId: certId,
    downloadURL,
    releasedAt: serverTimestamp(),
  });

  await addDoc(collection(doc(db, "users", userId), "notifications"), {
    type: "certificate_obtained",
    message: `Congratulations! A certificate has been issued for "${course}".`,
    event: course,
    createdAt: serverTimestamp(),
    read: false,
    popupShown: false,
  });

  return { certId, downloadURL };
}
