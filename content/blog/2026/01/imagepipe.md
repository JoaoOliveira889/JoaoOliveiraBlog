---
title: Otimizando Imagens para a Web com Go e Docker
date: '2026-01-03T00:00:00-00:00'
description: Aprenda a criar o ImagePipe, uma ferramenta em Go e Docker para converter imagens em WebP e redimensionar automaticamente para melhor performance e SEO.
tags:
- go
- docker
- webp
- performance
- tutorial
draft: false
---

![Article cover](https://joaooliveirablog.s3.us-east-1.amazonaws.com/019bc1c3-a76a-7e8f-b6dc-7605eb9cb63c.webp)

Quando decidi criar meu próprio blog, eu já tinha em mente que precisaria ser responsável pela hospedagem das imagens que usaria. Seria uma ótima oportunidade de aprender mais sobre o **AWS S3**, algo que já estava no meu roadmap de estudos, e trabalhar em um projeto real é, quase sempre, a melhor forma de aprender.

Assim que comecei a escrever o primeiro post, criei minha conta na AWS e bucket no S3 que usaria no blog. Porém, antes de começar a explorar o mar de configurações e possíveis otimizações, eu sabia que precisava otimizar minhas imagens. Existem milhares de serviços online que fazem isso, mas onde estaria a diversão? Eu queria algo local, rápido, customizado e que não dependesse de terceiros.

Decidi, então, construir o **ImagePipe**: uma ferramenta de CLI que converte imagens para WebP, redimensiona para um limite seguro de 1600px e pode ser executada em qualquer lugar via Docker.

## Por que WebP e 1600px?

O WebP é um formato moderno que oferece um equilíbrio incrível entre qualidade e desempenho:

- **Compressão Superior**: Reduz o tamanho do arquivo em até 35% comparado ao JPEG.
- **Versatilidade**: Suporta transparência (como PNG) e animações (como GIF) com arquivos muito menores.
- **SEO e Performance**: Imagens leves melhoram o LCP, um fator crucial para o ranking do Google.
- **Resolução Inteligente**: Limitar a largura a 1600px garante que a imagem seja nítida em telas grandes sem carregar pixels desnecessários que pesam no carregamento mobile.

## Criando o projeto em Go

O primeiro passo foi estruturar o módulo em Go. No terminal:

```bash
mkdir ImagePipe
cd ImagePipe
go mod init github.com/JoaoOliveira889/ImagePipe
```

Dentro dessa pasta, vamos criar um arquivo `main.go` e colar o código abaixo. O programa, por default, reduz a qualidade em 75%, mas esse valor pode ser alterado via parâmetro na execução. Também será possível executar localmente sem docker via `go run main.go` e então arrastar a imagem para o terminal ou digitar o full path.

Via docker, vamos configurar para que possa ser chamado de qualquer pasta do SO. Por exemplo: se estiver na pasta `pictures`, so basta executar `imagepipe photo.jpeg` para gerar a versão otimizada.

```go
package main

import (
	"bufio"
	"fmt"
	"image"
	_ "image/jpeg" // Register JPEG decoder for image.Decode
	_ "image/png"  // Register PNG decoder for image.Decode
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/chai2010/webp" // WebP encoder library
	"golang.org/x/image/draw"  // High-performance image scaling package
)

func main() {
	var inputPath string
	var qualityStr string
	quality := 75 // Default compression quality

	// 1. Input Handling: Supports both CLI arguments and interactive mode
	if len(os.Args) >= 2 {
		inputPath = os.Args[1]
		if len(os.Args) > 2 {
			qualityStr = os.Args[2]
		}
	} else {
		// Interactive Mode for local execution
		fmt.Println("Image to WebP Optimizer")
		fmt.Println("-----------------------")
		fmt.Print("\nPath (File or Folder): ")

		scanner := bufio.NewScanner(os.Stdin)
		if scanner.Scan() {
			inputPath = scanner.Text()
		}

		fmt.Print("Quality (Default 75): ")
		if scanner.Scan() {
			qualityStr = scanner.Text()
		}
	}

	// Clean path: Remove quotes and handle escaped spaces (common when dragging files to terminal)
	inputPath = strings.Trim(strings.TrimSpace(inputPath), "\"'")
	inputPath = strings.ReplaceAll(inputPath, `\ `, " ")

	if inputPath == "" {
		fmt.Println("Error: No path provided.")
		return
	}

	// Parse quality string to integer
	if qualityStr != "" {
		if q, err := strconv.Atoi(strings.TrimSpace(qualityStr)); err == nil {
			quality = q
		}
	}

	// 2. Path Analysis: Check if target is a single file or a directory
	fileInfo, err := os.Stat(inputPath)
	if err != nil {
		fmt.Printf("Error: Path '%s' not found.\n", inputPath)
		return
	}

	if fileInfo.IsDir() {
		// Batch Processing
		fmt.Printf("\nProcessing folder: %s\n", inputPath)
		files, _ := os.ReadDir(inputPath)
		for _, f := range files {
			ext := strings.ToLower(filepath.Ext(f.Name()))
			// Filter supported image formats
			if ext == ".jpg" || ext == ".jpeg" || ext == ".png" {
				processImage(filepath.Join(inputPath, f.Name()), quality)
			}
		}
	} else {
		// Single file processing
		processImage(inputPath, quality)
	}
}

// processImage handles the decoding, resizing, and WebP encoding logic
func processImage(path string, quality int) {
	file, err := os.Open(path)
	if err != nil {
		fmt.Printf("Error opening %s: %v\n", path, err)
		return
	}
	defer file.Close()

	inInfo, _ := file.Stat()
	img, _, err := image.Decode(file) // Decode the original image buffer
	if err != nil {
		fmt.Printf("Error decoding %s: Please use JPG or PNG\n", path)
		return
	}

	// 3. Resolution Optimization: Caps width at 1600px
	bounds := img.Bounds()
	if bounds.Dx() > 1600 {
		newW := 1600
		// Calculate height maintaining the original aspect ratio
		newH := (bounds.Dy() * newW) / bounds.Dx()
		
		dst := image.NewRGBA(image.Rect(0, 0, newW, newH))
		
		// Use Catmull-Rom resampling for high-quality downscaling
		draw.CatmullRom.Scale(dst, dst.Bounds(), img, bounds, draw.Over, nil)
		img = dst
	}

	// 4. Output Creation: Append timestamp to filename to prevent overwriting
	ts := time.Now().Format("150405")
	outPath := strings.TrimSuffix(path, filepath.Ext(path)) + "_" + ts + ".webp"

	outFile, err := os.Create(outPath)
	if err != nil {
		fmt.Printf("Error creating output file: %v\n", err)
		return
	}
	defer outFile.Close()

	// 5. WebP Encoding: Apply final compression
	err = webp.Encode(outFile, img, &webp.Options{Quality: float32(quality)})
	if err != nil {
		fmt.Printf("Error encoding WebP: %v\n", err)
		return
	}

	// 6. Performance Report: Calculate and display size reduction
	outInfo, _ := os.Stat(outPath)
	savings := float64(inInfo.Size()-outInfo.Size()) / float64(inInfo.Size()) * 100
	fmt.Printf("✔ %s | Reduced: %.1f%% (Final: %d KB)\n", 
		filepath.Base(outPath), 
		savings, 
		outInfo.Size()/1024,
	)
}
```

Eu defini para trabalhar apenas com imagens em PNG e JPEG. Se precisar adicionar outros formatos, é so acrescentar aqui:

```go
"image"
	_ "image/jpeg"
	_ "image/png"
```

### Instalando dependências

Agora, na pasta do projeto, vamos instalar as duas dependências:

```bash
go get github.com/chai2010/webp
go get golang.org/x/image/draw
go mod tidy
```

Com isso, já é possível executar o projeto com:

```bash
go run main.go
```

No terminal, basta arrastar a imagem a ser convertida ou passar o full patch. Em seguida, será perguntado se deseja alterar a qualidade padrão. Se quiser, informe o novo valor; caso contrário, pressione Enter para manter o padrão e executar o programa.

![Programa rodando no terminal](https://joaooliveirablog.s3.us-east-1.amazonaws.com/ImagePipe1_004744.webp)

## Rodando via Docker (chamando de qualquer pasta)

Eu não quero repetir o fluxo manual toda vez que precisar preparar imagens para publicar no S3. Então, empacotei a ferramenta em um Docker Multi-stage build. Isso gera uma imagem final extremamente leve, contendo apenas o binário necessário.

O Dockerfile:

```dockerfile
# Stage 1: Build the binary
FROM golang:1.25.5-alpine AS builder

# Install build dependencies for CGO
RUN apk add --no-cache gcc musl-dev

WORKDIR /app

# Copy dependency files
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source code
COPY . .

# IMPORTANT: We use TARGETARCH to make this work on any machine
ARG TARGETARCH
RUN CGO_ENABLED=1 GOOS=linux GOARCH=$TARGETARCH go build -o imagepipe .

# Stage 2: Final lightweight image
FROM alpine:latest
RUN apk add --no-cache libc6-compat

WORKDIR /data
COPY --from=builder /app/imagepipe /usr/local/bin/imagepipe

ENTRYPOINT ["imagepipe"]
```

Agora, basta construir a imagem

```bash
docker build -t imagepipe .
```

![Exemplo configuração NeoVim](https://joaooliveirablog.s3.us-east-1.amazonaws.com/ImagePipe3_004744.webp)

## Facilitando o uso com Shell Functions

Como o objetivo é conseguir chamar a partir de qualquer pasta, vamos configurar uma função no shell. Vou usar o Neovim para editar o `~/.zshrc`, mas você pode usar o editor que preferir

```bash
nvim ~/.zshrc
```

No final do arquivo, adicione

```bash
imagepipe() {
    docker run --rm -it -v "$(pwd)":/data imagepipe "$1" "$2"
}
```

O que esse comando faz?

- --rm: Remove o container após o uso, mantendo seu sistema limpo.
- -v "$(pwd)":/data: Mapeia a sua pasta atual para dentro do container. Assim, o ImagePipe lê suas fotos locais e salva os resultados na mesma pasta.
- $1 e $2: São os argumentos de caminho e qualidade que você passa no terminal.

![Exemplo de imagem no Docker](https://joaooliveirablog.s3.us-east-1.amazonaws.com/ImagePipe2_004744.webp)

Agora vamos fazer o reload do shell

```bash
source ~/.zshrc
```

## Resultado Final

Para executar via Docker, basta usar um dos comandos abaixo na pasta que contém as imagens

| Objetivo                               | Comando                |
| -------------------------------------- | ---------------------- |
| Converter uma imagem específica        | imagepipe photo.jpg    |
| Definir uma qualidade específica (90%) | imagepipe photo.jpg 90 |
| Otimizar todas imagens da pasta        | imagepipe .            |

O programa gera um arquivo .webp com um timestamp no nome, garantindo que suas imagens originais nunca sejam sobrescritas.

![Exemplo de imagens convertidas](https://joaooliveirablog.s3.us-east-1.amazonaws.com/ImagePipe4_004744.webp)

## Conclusão

Com esse projeto simples, eu consigo otimizar rapidamente minhas imagens para subir no S3 sem depender de nenhum sistema externo, e ainda consigo adaptar o fluxo para diferentes cenários sempre que precisar. Não é sobre reinventar a roda, é sobre criar algo útil, divertido e totalmente ajustado às minhas necessidades.

## Links e Referências

- Projeto: [Repositório no GitHub](https://github.com/JoaoOliveira889/ImagePipe)
- Libs: [Chai2010/WebP](https://github.com/chai2010/webp) | [Go Draw](https://pkg.go.dev/golang.org/x/image/draw)
