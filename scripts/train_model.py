"""
Train a lightweight CNN for chess piece classification using PyTorch.
Exports the model as ONNX and then converts to a pure JSON weights format
that can be loaded directly in the browser without any ML framework dependency.
"""

import os
import json
import struct
import numpy as np
from PIL import Image
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader, random_split


# ─── Configuration ───────────────────────────────────────────────────────────
TRAINING_DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'training_data')
MODEL_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'model')

# Case-safe folder names
CLASSES = [
    'empty',
    'white_K', 'white_Q', 'white_R', 'white_B', 'white_N', 'white_P',
    'black_k', 'black_q', 'black_r', 'black_b', 'black_n', 'black_p'
]

# Exported label names (must match tfService.js CLASS_NAMES order)
EXPORTED_CLASS_NAMES = ['empty', 'K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p']

NUM_CLASSES = 13
IMG_SIZE = 32
BATCH_SIZE = 64
EPOCHS = 35
LEARNING_RATE = 0.001
VAL_SPLIT = 0.2


# ─── Dataset ─────────────────────────────────────────────────────────────────
class ChessTileDataset(Dataset):
    def __init__(self, root_dir):
        self.samples = []
        self.labels = []
        
        for class_idx, class_name in enumerate(CLASSES):
            class_dir = os.path.join(root_dir, class_name)
            if not os.path.isdir(class_dir):
                print(f"WARNING: Missing class directory: {class_dir}")
                continue
            
            for fname in os.listdir(class_dir):
                if fname.endswith('.png'):
                    self.samples.append(os.path.join(class_dir, fname))
                    self.labels.append(class_idx)
        
        print(f"Loaded {len(self.samples)} samples across {NUM_CLASSES} classes")
    
    def __len__(self):
        return len(self.samples)
    
    def __getitem__(self, idx):
        img = Image.open(self.samples[idx]).convert('L')
        img = img.resize((IMG_SIZE, IMG_SIZE), Image.Resampling.LANCZOS)
        
        # Convert to tensor: [1, 32, 32], normalized to [0, 1]
        arr = np.array(img, dtype=np.float32) / 255.0
        tensor = torch.from_numpy(arr).unsqueeze(0)  # Add channel dim
        
        label = self.labels[idx]
        return tensor, label


# ─── Model ───────────────────────────────────────────────────────────────────
class ChessPieceCNN(nn.Module):
    """Lightweight CNN for 13-class chess piece classification."""
    
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(
            # Conv block 1: 32x32x1 -> 16x16x32
            nn.Conv2d(1, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
            
            # Conv block 2: 16x16x32 -> 8x8x64
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
            
            # Conv block 3: 8x8x64 -> 4x4x128
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
        )
        
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(128 * 4 * 4, 256),
            nn.ReLU(inplace=True),
            nn.Dropout(0.4),
            nn.Linear(256, NUM_CLASSES),
        )
    
    def forward(self, x):
        x = self.features(x)
        x = self.classifier(x)
        return x


# ─── Export to JSON (for browser) ────────────────────────────────────────────
def export_model_to_json(model, output_dir):
    """
    Export model weights to a simple JSON format that can be loaded
    directly in the browser without any ML framework.
    """
    os.makedirs(output_dir, exist_ok=True)
    
    model.eval()
    state_dict = model.state_dict()
    
    # Build architecture description
    architecture = {
        'input_shape': [1, IMG_SIZE, IMG_SIZE],
        'num_classes': NUM_CLASSES,
        'class_names': EXPORTED_CLASS_NAMES,
        'layers': []
    }
    
    # Collect all weight tensors and their metadata
    weights_meta = []
    all_weights = []
    
    for name, param in state_dict.items():
        tensor = param.cpu().numpy()
        shape = list(tensor.shape)
        offset = sum(w.size for w in all_weights) * 4  # bytes
        
        weights_meta.append({
            'name': name,
            'shape': shape,
            'dtype': 'float32',
            'offset': offset,
            'size': tensor.size
        })
        all_weights.append(tensor.flatten())
        
        print(f"  Weight: {name:40s} shape={shape}")
    
    architecture['weights'] = weights_meta
    
    # Save architecture JSON
    arch_path = os.path.join(output_dir, 'chess_model.json')
    with open(arch_path, 'w') as f:
        json.dump(architecture, f)
    print(f"\nArchitecture saved to: {arch_path}")
    
    # Save weights as binary float32
    weights_path = os.path.join(output_dir, 'chess_model.bin')
    concatenated = np.concatenate(all_weights)
    with open(weights_path, 'wb') as f:
        f.write(concatenated.astype(np.float32).tobytes())
    
    size_kb = os.path.getsize(weights_path) / 1024
    print(f"Weights saved to: {weights_path} ({size_kb:.1f} KB)")
    
    return arch_path, weights_path


# ─── Training Loop ───────────────────────────────────────────────────────────
def train():
    device = torch.device('cpu')  # CPU-only for maximum compatibility
    print(f"Device: {device}")
    print(f"Loading data from: {os.path.abspath(TRAINING_DATA_DIR)}")
    
    # Load dataset
    dataset = ChessTileDataset(TRAINING_DATA_DIR)
    
    # Split into train/val
    val_size = int(len(dataset) * VAL_SPLIT)
    train_size = len(dataset) - val_size
    train_dataset, val_dataset = random_split(dataset, [train_size, val_size])
    
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)
    
    print(f"Train: {train_size} samples, Val: {val_size} samples")
    print(f"Batch size: {BATCH_SIZE}, Epochs: {EPOCHS}")
    print()
    
    # Create model
    model = ChessPieceCNN().to(device)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"Model parameters: {total_params:,}")
    print()
    
    # Loss and optimizer
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=5, factor=0.5)
    
    best_val_acc = 0.0
    
    for epoch in range(EPOCHS):
        # ── Train ──
        model.train()
        train_loss = 0.0
        train_correct = 0
        train_total = 0
        
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item() * images.size(0)
            _, predicted = outputs.max(1)
            train_total += labels.size(0)
            train_correct += predicted.eq(labels).sum().item()
        
        train_loss /= train_total
        train_acc = 100.0 * train_correct / train_total
        
        # ── Validate ──
        model.eval()
        val_loss = 0.0
        val_correct = 0
        val_total = 0
        
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                
                outputs = model(images)
                loss = criterion(outputs, labels)
                
                val_loss += loss.item() * images.size(0)
                _, predicted = outputs.max(1)
                val_total += labels.size(0)
                val_correct += predicted.eq(labels).sum().item()
        
        val_loss /= val_total
        val_acc = 100.0 * val_correct / val_total
        
        scheduler.step(val_loss)
        
        marker = ''
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            marker = ' ★'
            # Save best model
            torch.save(model.state_dict(), os.path.join(MODEL_OUTPUT_DIR, 'best_model.pth'))
        
        print(f"Epoch [{epoch+1:3d}/{EPOCHS}]  "
              f"Train Loss: {train_loss:.4f}  Acc: {train_acc:5.1f}%  |  "
              f"Val Loss: {val_loss:.4f}  Acc: {val_acc:5.1f}%{marker}")
    
    print(f"\nBest validation accuracy: {best_val_acc:.1f}%")
    
    # Load best model and export
    print("\n── Exporting model ──")
    model.load_state_dict(torch.load(os.path.join(MODEL_OUTPUT_DIR, 'best_model.pth'), weights_only=True))
    model.eval()
    
    export_model_to_json(model, MODEL_OUTPUT_DIR)
    
    # Clean up the .pth file
    pth_path = os.path.join(MODEL_OUTPUT_DIR, 'best_model.pth')
    if os.path.exists(pth_path):
        os.remove(pth_path)
        print(f"Cleaned up: {pth_path}")
    
    print("\n✓ Training complete! Model ready for browser deployment.")


if __name__ == '__main__':
    os.makedirs(MODEL_OUTPUT_DIR, exist_ok=True)
    train()
