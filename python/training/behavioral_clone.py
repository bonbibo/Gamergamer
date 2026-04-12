"""
Behavioral cloning model.

Architecture:
  Frozen ViT-B/16 backbone (timm) → 768-dim embedding
  → MLP head → [N_KEYS binary logits] + [2 mouse delta regression]

Total trainable params: ~2M (MLP head only).
"""
from __future__ import annotations

from python.training.dataset_builder import N_KEYS

try:
    import torch
    import torch.nn as nn
    try:
        import timm
        TIMM_AVAILABLE = True
    except ImportError:
        TIMM_AVAILABLE = False
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False


ACTION_DIM = N_KEYS + 2  # keys + (mouse_dx, mouse_dy)


class BehavioralCloneModel(nn.Module):  # type: ignore[misc]
    def __init__(self, embed_dim: int = 768):
        super().__init__()
        if not TORCH_AVAILABLE:
            raise RuntimeError("PyTorch not installed.")
        if not TIMM_AVAILABLE:
            raise RuntimeError("timm not installed. Run: pip install timm")

        self.backbone = timm.create_model("vit_base_patch16_224", pretrained=True, num_classes=0)
        for param in self.backbone.parameters():
            param.requires_grad = False

        self.key_head = nn.Sequential(
            nn.Linear(embed_dim, 256),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(256, N_KEYS),
        )
        self.mouse_head = nn.Sequential(
            nn.Linear(embed_dim, 128),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(128, 2),
            nn.Tanh(),
        )

    def forward(self, x):
        with torch.no_grad():
            emb = self.backbone(x)
        key_logits = self.key_head(emb)
        mouse_delta = self.mouse_head(emb)
        return key_logits, mouse_delta


def create_model() -> "BehavioralCloneModel":
    return BehavioralCloneModel()
