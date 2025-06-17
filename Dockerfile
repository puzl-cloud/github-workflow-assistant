ARG NODE_TAG=22-slim
ARG PYTHON_VERSION=3.11
ARG PYTHON_TAG=$PYTHON_VERSION-slim

FROM node:$NODE_TAG AS node-build

WORKDIR /app
COPY ui/ .

RUN npm install

RUN npm run build

FROM python:$PYTHON_TAG AS python-build

WORKDIR /tmp

COPY requirements.txt .

RUN pip3 install -r requirements.txt

FROM python:$PYTHON_TAG
ARG PYTHON_VERSION

ENV LISTEN_PORT=3000 \
    PYTHONPATH=/usr/local/lib/python$PYTHON_VERSION/site-packages
 
WORKDIR /app

COPY --from=node-build app/dist html
COPY --from=python-build /usr/local/lib/python$PYTHON_VERSION/site-packages /usr/local/lib/python$PYTHON_VERSION/site-packages

COPY . .

RUN apt-get update \
    && apt-get install --no-install-recommends -y \
       git

CMD ["python3", "app.py"]
