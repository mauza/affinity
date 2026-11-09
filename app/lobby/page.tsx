import QRCode from "qrcode";
import Lobby from "@/components/map/Lobby";
export default async function LobbyPage() {
  const qr = await QRCode.toString("https://kubecon.mau.guru", { type: "svg", margin:2, color: { dark:"#111d2c", light:"#ffffff" } });
  return <Lobby qr={qr}/>;
}
