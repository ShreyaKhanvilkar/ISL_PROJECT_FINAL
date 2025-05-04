from flask import Flask,render_template, request, jsonify
import numpy as np
from subprocess import CalledProcessError, run
import re
import json
import io
from PIL import Image, ImageEnhance
import torch
from torchvision import transforms
from transformers import TrOCRProcessor, VisionEncoderDecoderModel

app = Flask(__name__, template_folder='templates')

with open('static/json/reference.json', 'r') as json_file:
    reference_data = json.load(json_file)

def modify_words(text): #modifies words so all of them are in the dictionary 
    words = re.findall(r'\b\w+\b', text.lower().strip()) 
    return ' '.join(words)

# Load TrOCR model and processor once at startup
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
processor = TrOCRProcessor.from_pretrained("microsoft/trocr-base-handwritten", use_fast=True)
model = VisionEncoderDecoderModel.from_pretrained("microsoft/trocr-base-handwritten").to(device)

@app.route("/")
def home():
    return render_template('index.html')

@app.route("/", methods=['POST']) #check for empty files or no file updated
def upload_file():
    # f = request.files['file']
    # rawText = process_audio(custom_load_audio(f.read()))
    # modText = modify_words(rawText)
    # return jsonify({'rawText':rawText,'modText': modText})
    return

@app.route("/handwriting-ocr", methods=["POST"])
def handwriting_ocr():
    if 'image' not in request.files:
        return jsonify({"error": "No image file provided"}), 400
    file = request.files['image']
    try:
        image = Image.open(file.stream).convert("RGB")
        # Enhance image
        image = image.convert("L").convert("RGB")  # Grayscale to RGB
        image = ImageEnhance.Contrast(image).enhance(2.0)
        # Resize and crop
        resize = transforms.Resize((384, 384))
        crop = transforms.CenterCrop(384)
        image = resize(image)
        image = crop(image)
        # OCR
        pixel_values = processor(images=image, return_tensors="pt").pixel_values.to(device)
        with torch.no_grad():
            generated_ids = model.generate(pixel_values, max_length=64)
            recognized_text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
        recognized_text = ' '.join(recognized_text.replace(" ", ""))
        return jsonify({"recognized_text": recognized_text})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5001)
