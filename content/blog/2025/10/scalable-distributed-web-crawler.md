---
title: Scalable Distributed Web Crawler
date: '2025-10-24T15:20:00-02:00'
tags:
- systemdesign
- webscraping
- distributedsystems
draft: false
---

Goal: To design a distributed web crawler capable of processing 100 million pages per day, demanding high throughput (2,500+ RPS peak) while strictly adhering to web politeness protocols.

## System Requirements

### Functional Requirements (FR)

- **FR-01 Seed URL Ingestion**: The system must be able to accept initial URL seeds to begin the crawl.
- **FR-02 Text Extraction and Storage**: Text content must be extracted from pages and stored in a durable persistence layer for later analysis.
- **FR-03 Freshness / Re-crawling**: URLs must be revisited periodically to ensure data freshness, respecting specified Crawl-delay or pre-set recrawl intervals.

### Non-Functional Requirements (NFR)

- **NFR-01 Performance (Scale)**: The system must sustain **100 million pages per day** (2,500 + RPS peak).
- **NFR-02 Politeness (Rate Limiting)**: A distributed Rate Limiting mechanism is mandatory to enforce a minimum delay (1-2 seconds or `Crawl-delay`) per host.
- **NFR-03 Resilience & Fault Tolerance**: The system must be resilient to failures, implementing Retry logic with Exponential Backoff and using a **Dead-Letter Queue** (**DLQ**).
- **NFR-04 Optimization**: The system must utilize HTTP headers (`If-Modified-Since / ETag`) to avoid downloading unchanged content (bandwidth optimization).

## Back-of-the-Envelope Estimation

The capacity estimates justify our choice of distributed technologies:

- **Throughput**: The average requirement of ≈ **1,157** RPS escalates to a peak design capacity of **2,500** to **3,000** RPS to handle overhead and retries.
- **Content Storage**: At 10 KB of text per page, we face 1 TB per day (365 TB annually). This mandates a low-cost, high-capacity **Object Storage** solution (like **AWS S3**).
- **Metadata Storage**: Storing critical URL state (timestamps, ETag) for 5 billion unique URLs requires a highly performant **NoSQL** database optimized for high read/write volume (like **Cassandra**).

## High-Level Design (HLD) Components and Data Flow

The architecture is separated into specialized services, orchestrated by asynchronous queues to decouple network-bound and CPU-bound tasks.

### Core Components and Politeness Enforcement

1. **URL Frontier Queue (Apache Kafka)**: Serves as the central persistent queue for all URLs waiting to be crawled.
2. **Scheduler Service**: Pulls URLs from the Frontier, enforces politeness checks, and manages the scheduling of the next crawl.
3. **Rate Limiter (Redis)**: An in-memory key-value store used to quickly check the last crawl time for any given host.
4. **Downloader Workers**: A massive, scalable pool responsible for making the actual HTTP requests.
5. **Persistence Layer (Cassandra)**: The NoSQL database storing URL metadata (state, ETag, last crawl time) for Deduplication (FR-04) and Freshness checks (FR-03).

## Architectural Deep Dive and Optimization

### The Scalable URL Frontier and Host-Based Partitioning

To maximize throughput while strictly adhering to politeness (NFR-02), the Kafka Frontier is optimized using **Host-Based Partitioning**.

- **Partitioning Strategy**: URLs are partitioned based on their hostname hash (e.g., `hash(google.com)`).
- **Benefit**: All URLs belonging to the same host are guaranteed to land on the same Kafka partition. This allows a single, dedicated instance of the **Scheduler Service** to process all requests for that host sequentially, making the distributed rate-limiting check much simpler and more reliable. This effectively transforms the distributed problem into a per-partition serial processing task.

### Politeness Enforcement (Scheduler and Redis)

The Scheduler Service and Redis work together to strictly enforce the per-host delay (NFR-02).

1. **Scheduler Action**: The Scheduler pulls the next URL from its assigned Kafka partition.
2. **Redis Check**: It queries Redis using the key structure `HOST:{hostname}`.
3. **Atomic Politeness Check (Optimization)**: To prevent race conditions among multiple Schedulers, the check-and-update operation must be atomic. This is best achieved using a Redis Lua Script that performs both steps:
   1. Check: Read the timestamp of the last access for the host.
   2. Update: If the required delay has passed, update the timestamp with the current time and return `ALLOW`. Otherwise, return `DELAY`.
4. **URL Requeueing**: If the check returns `DELAY` the URL is immediately sent back to the Kafka Frontier (or an internal Delay Queue) with a time-to-wait parameter.

### Deduplication, Freshness, and the Cassandra Data Model

The NoSQL Storage (Cassandra) is crucial for managing the state of billions of URLs. Its data model must support two extremely fast lookups:

1. Politeness: Quick retrieval of the last crawl time.
2. Deduplication (FR-04): Quick check if a newly discovered URL has already been processed.

Cassandra Schema Design:

| Field                  | Description                                              | Purpose                                              |
| ---------------------- | -------------------------------------------------------- | ---------------------------------------------------- |
| url_hash (Primary Key) | A unique hash of the full URL (e.g., SHA-256).           | Fast Deduplication (FR-04) and uniqueness guarantee. |
| hostname               | The host portion of the URL.                             | Used for politeness lookups and partitioning data.   |
| last_crawl_time        | Timestamp of the last successful fetch.                  | Required by the Scheduler for Politeness (NFR-02).   |
| etag_header            | The ETag value from the last response.                   | Required for Optimization (NFR-04).                  |
| status                 | Current state (e.g., TO_CRAWL, CRAWLED, PERMANENT_FAIL). |                                                      |

Optimization and Resilience Flow
The design incorporates advanced features for efficiency and reliability:

- **Bandwidth Optimization (NFR-04)**: Downloader Workers check the Cassandra store for the `etag_header` and `last_crawl_time`. They then use the HTTP headers `If-Modified-Since` and `If-None-Match`(**using the ETag**) in the request. If the content is unchanged, the server returns a 304 (Not Modified), saving significant bandwidth and processing load.

- **Resilience (NFR-03)**: The retry mechanism is implemented in the Downloader Worker:
  - Retry Path: Transient errors (e.g., timeouts, 5xx errors) trigger a message sent back to the Download Queue with a scheduled delay tag, implementing **Exponential Backoff** (`2^n` delay, max 3 retries).
  - **Permanent Fail Path**: After the retry limit is exhausted, the URL is routed to the **Dead-Letter Queue (DLQ)** (NFR-03) for out-of-band analysis, preventing toxic messages from clogging the system.
- **DNS Caching**: The Downloader Workers utilize a local **DNS Cache (Redis)** to minimize latency and reduce reliance on external DNS lookups for frequently accessed hosts.

![The System Design for a Web Crawler](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/edspwmff8l9g8qdcvlzz.png)
