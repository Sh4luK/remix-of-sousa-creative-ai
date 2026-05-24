import { ChevronUp, ChevronDown, Check, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProductPick } from "@/types/database.types";
import { formatPrice } from "../utils/formatPrice";

interface Step2Props {
  pick: ProductPick;
  currentPrice: string;
  setCurrentPrice: (v: string) => void;
  previousPrice: string;
  setPreviousPrice: (v: string) => void;
  quantity: string;
  setQuantity: (v: string) => void;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  discountSeal: string;
  setDiscountSeal: (v: string) => void;
  headline: string;
  setHeadline: (v: string) => void;
  voicePrice: string | null;
  onConfirmVoicePrice: () => void;
  onRejectVoicePrice: () => void;
}

export function Step2Price({
  pick,
  currentPrice,
  setCurrentPrice,
  previousPrice,
  setPreviousPrice,
  quantity,
  setQuantity,
  showAdvanced,
  setShowAdvanced,
  discountSeal,
  setDiscountSeal,
  headline,
  setHeadline,
  voicePrice,
  onConfirmVoicePrice,
  onRejectVoicePrice,
}: Step2Props) {
  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Detalhes da oferta</h2>
        <p className="text-sm text-slate-500 mt-1">Só o preço já basta. O resto é opcional.</p>
      </div>

      {voicePrice && (
        <div className="rounded-2xl border-2 border-sky-300 bg-gradient-to-br from-sky-50 to-teal-50 p-4 sm:p-5 shadow-sm animate-fade-up">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
              <span className="text-lg">🎤</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                Entendi pelo seu áudio: <span className="text-sky-700">{voicePrice}</span>
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                O preço está certo? Confirme para avançar ou corrija no campo abaixo.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button
                  onClick={onConfirmVoicePrice}
                  type="button"
                  className="bg-sky-600 hover:bg-sky-700 text-white h-10"
                >
                  <Check className="h-4 w-4 mr-1.5" /> Sim, está certo
                </Button>
                <Button
                  onClick={onRejectVoicePrice}
                  type="button"
                  variant="outline"
                  className="h-10 border-sky-200 text-sky-800 hover:bg-sky-100"
                >
                  Corrigir preço
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div className="h-16 w-16 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden text-3xl shrink-0">
          {pick.kind === "upload" ? (
            <img src={pick.previewUrl} alt={pick.name} className="h-full w-full object-cover" />
          ) : pick.kind === "catalog" ? (
            <span>{pick.emoji}</span>
          ) : (
            <span>🎤</span>
          )}
        </div>
        <div className="flex-1">
          <div className="text-xs text-slate-500 uppercase tracking-wide font-medium">Produto escolhido</div>
          <div className="font-semibold text-slate-900">{pick.name}</div>
        </div>
      </div>

      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-900">
        <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 text-sky-600" />
        <p className="text-xs sm:text-sm leading-relaxed">
          Coloque o preço bem destacado — é o que mais chama a atenção do cliente.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium text-slate-700">
            Preço Atual <span className="text-sky-600">*</span>
          </Label>
          <Input
            value={currentPrice}
            onChange={(e) => setCurrentPrice(formatPrice(e.target.value))}
            inputMode="numeric"
            placeholder="R$ 0,00"
            className="mt-1.5 h-14 text-2xl font-bold tracking-tight"
          />
          <p className="text-xs text-slate-500 mt-1.5">É só digitar os números, a gente formata pra você.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium text-slate-700">Preço Antigo (opcional)</Label>
            <Input
              value={previousPrice}
              onChange={(e) => setPreviousPrice(formatPrice(e.target.value))}
              inputMode="numeric"
              placeholder="R$ 0,00"
              className="mt-1.5 h-12"
            />
            <p className="text-xs text-slate-400 mt-1">Aparece riscado, mostrando o desconto.</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-700">Quantidade / Volume</Label>
            <Input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Ex: 5kg, 2L, 500ml"
              className="mt-1.5 h-12"
            />
            <p className="text-xs text-slate-400 mt-1">Tamanho ou peso do produto.</p>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          type="button"
          className="flex items-center gap-2 text-sm font-medium text-sky-700 hover:text-sky-800"
        >
          {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {showAdvanced ? "Ocultar" : "Ver"} Opções Avançadas
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 animate-fade-up">
            <div>
              <Label className="text-sm font-medium text-slate-700">Selo de Desconto</Label>
              <Input
                value={discountSeal}
                onChange={(e) => setDiscountSeal(e.target.value)}
                placeholder="Ex: 20% OFF, OFERTA, IMPERDÍVEL"
                className="mt-1.5 h-12"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">Título Principal da Oferta</Label>
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Ex: Mega Promoção da Semana"
                className="mt-1.5 h-12"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
