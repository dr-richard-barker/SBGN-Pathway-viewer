#!/usr/bin/env Rscript
# Rich static "panel figures" via ggkegg: a grammar-of-graphics KEGG pathway map
# (gene nodes coloured by log2FC, metabolite/cofactor COMPOUND nodes labelled by
# name, reaction/relation edges) beside a heatmap of the pathway's significant
# loci. Red (+ve) / white (0) / blue (-ve). Replaces the plain node-link panels.
#
# Usage: Rscript tools/build_panels_gg.R [OSD-123,OSD-456]
suppressWarnings(suppressMessages({
  library(ggkegg); library(tidygraph); library(dplyr); library(ggraph)
  library(ggplot2); library(patchwork)
}))

ROOT <- "C:/Users/drric/Downloads/SBGN-Pathway-viewer"
setwd(ROOT)
PANELS <- file.path(ROOT, "book", "_static", "panels")
SLIM <- file.path(ROOT, "public", "osdr")
dir.create(PANELS, showWarnings = FALSE, recursive = TRUE)

SIG <- 3; LFC <- 1.0; PADJ <- 0.05; MAXHEAT <- 40
LOW <- "#2166ac"; HIGH <- "#b2182b"
args <- commandArgs(trailingOnly = TRUE)
only <- if (length(args) >= 1) strsplit(args[1], ",")[[1]] else NULL

matrix <- read.csv("book/data/pathway_projection_matrix.csv", check.names = FALSE)
sf <- read.csv("book/data/study_files.csv"); files <- setNames(sf$file, sf$osd)

# Cellular site (UniProt subcellular location) per locus + a fixed palette so the
# colours mean the same thing across every panel.
cmp <- tryCatch(read.delim("book/data/gene_compartments.tsv"), error = function(e) NULL)
comp_of <- if (!is.null(cmp)) setNames(cmp$compartment, toupper(cmp$locus)) else character(0)
COMP_PAL <- c(
  "Nucleus" = "#6a3d9a", "Chloroplast" = "#33a02c", "Mitochondrion" = "#e31a1c",
  "Endoplasmic reticulum" = "#ff7f00", "Golgi" = "#b15928", "Plasma membrane" = "#1f78b4",
  "Vacuole" = "#a6cee3", "Peroxisome" = "#fb9a99", "Cell wall / apoplast" = "#b2df8a",
  "Cytoplasm" = "#fdbf6f", "Membrane (unspecified)" = "#cab2d6", "Other / unknown" = "#dddddd")

# compound id -> short name
cn <- read.delim("book/data/kegg_compound_names.tsv", header = FALSE, quote = "")
cname <- setNames(sub(";.*", "", cn$V2), sub("^cpd:", "", cn$V1))
short <- function(ids) {
  ids <- sub("^cpd:", "", ids)
  nm <- cname[ids]; nm[is.na(nm)] <- ids[is.na(nm)]
  substr(nm, 1, 15)
}

is_locus <- function(s) grepl("^AT[1-5MC]G[0-9]{5}$", s, ignore.case = TRUE)
graph_cache <- new.env()
get_pathway <- function(pid) {
  if (is.null(graph_cache[[pid]])) graph_cache[[pid]] <- pathway(pid)
  graph_cache[[pid]]
}

sig_rows <- matrix[as.integer(matrix$n_sig) >= SIG, ]
if (!is.null(only)) sig_rows <- sig_rows[sig_rows$accession %in% only, ]
done <- 0
for (i in seq_len(nrow(sig_rows))) {
  r <- sig_rows[i, ]; acc <- r$accession; pid <- r$kegg_pathway; nm <- r$pathway_name
  f <- files[[acc]]; if (is.null(f)) next
  slim <- tryCatch(read.csv(file.path(SLIM, f)), error = function(e) NULL); if (is.null(slim)) next
  lfc <- setNames(suppressWarnings(as.numeric(slim$log2FoldChange)), toupper(slim$gene_id))
  padj <- setNames(suppressWarnings(as.numeric(slim$padj)), toupper(slim$gene_id))
  g <- tryCatch(get_pathway(pid), error = function(e) NULL); if (is.null(g)) next
  nd <- g |> activate(nodes) |> as_tibble()

  member <- lapply(nd$name, function(x) toupper(gsub("ath:", "", strsplit(x, " ")[[1]], fixed = TRUE)))
  val <- vapply(member, function(ids) { v <- lfc[ids]; v <- v[!is.na(v)]
    if (length(v) == 0) NA_real_ else v[which.max(abs(v))] }, numeric(1))
  # first-locus -> symbol
  loc2sym <- list()
  for (k in seq_len(nrow(nd))) {
    ids <- member[[k]]; s <- trimws(gsub("...", "", nd$graphics_name[k], fixed = TRUE))
    if (length(ids) && nzchar(s) && !is_locus(s) && is.null(loc2sym[[ids[1]]])) loc2sym[[ids[1]]] <- s
  }
  is_gene <- nd$type %in% c("gene", "ortholog"); is_cpd <- nd$type == "compound"
  gsym <- vapply(seq_len(nrow(nd)), function(k) {
    ids <- member[[k]]; s <- trimws(gsub("...", "", nd$graphics_name[k], fixed = TRUE)); s }, character(1))
  # cellular compartment per node = first member locus with a known compartment
  node_comp <- vapply(member, function(ids) {
    cs <- unname(comp_of[ids]); cs <- cs[!is.na(cs) & cs != "Other / unknown"]
    if (length(cs)) cs[1] else "Other / unknown" }, character(1))
  g <- g |> activate(nodes) |>
    mutate(value = val, is_gene = is_gene, is_cpd = is_cpd,
           ncomp = factor(ifelse(is_gene, node_comp, NA), levels = names(COMP_PAL)),
           glab = ifelse(is_gene & !is.na(value) & abs(value) > LFC, gsym, NA),
           clab = ifelse(is_cpd, short(name), NA))
  mx <- max(abs(val), na.rm = TRUE); if (!is.finite(mx)) mx <- 1

  # Gene boxes: FILL = log2FC, OUTLINE = cellular compartment (dual encoding).
  pmap <- ggraph(g, layout = "manual", x = x, y = y) +
    geom_edge_link(color = "grey82", width = 0.22) +
    geom_node_rect(aes(filter = is_cpd), fill = "grey96", color = "grey60", linewidth = 0.15) +
    geom_node_rect(aes(filter = is_gene, fill = value, color = ncomp), linewidth = 0.5) +
    geom_node_point(aes(filter = is_cpd), shape = 21, fill = "grey96", color = "grey55", size = 1.2) +
    geom_node_text(aes(filter = is_cpd, label = clab), size = 1.15, color = "grey45", nudge_y = -8) +
    geom_node_text(aes(filter = is_gene & !is.na(glab), label = glab), size = 1.7, color = "grey10") +
    scale_fill_gradient2(low = LOW, mid = "white", high = HIGH, midpoint = 0,
                         limits = c(-mx, mx), na.value = "grey90", name = "log2FC") +
    scale_color_manual(values = COMP_PAL, drop = FALSE, na.value = "grey70",
                       name = "Cellular site\n(UniProt)") +
    guides(color = guide_legend(override.aes = list(fill = "white"))) +
    theme_void() + coord_fixed() + ggtitle(paste0(acc, " · ", nm))

  # heatmap of significant loci in this pathway
  path_loci <- unique(unlist(member[is_gene]))
  sig <- path_loci[!is.na(lfc[path_loci]) & abs(lfc[path_loci]) > LFC &
                     !is.na(padj[path_loci]) & padj[path_loci] < PADJ]
  if (length(sig) > MAXHEAT) sig <- sig[order(-abs(lfc[sig]))][seq_len(MAXHEAT)]
  sig <- sig[order(lfc[sig])]
  if (length(sig)) {
    labs <- vapply(sig, function(l) { s <- loc2sym[[l]]; if (is.null(s)) l else s }, character(1))
    comp <- unname(comp_of[sig]); comp[is.na(comp)] <- "Other / unknown"
    comp <- factor(comp, levels = names(COMP_PAL))
    hd <- data.frame(y = seq_along(sig), lab = labs, v = lfc[sig], comp = comp)
    hmx <- max(abs(hd$v)); if (!is.finite(hmx) || hmx == 0) hmx <- 1
    nsig_total <- length(path_loci[!is.na(lfc[path_loci]) & abs(lfc[path_loci]) > LFC &
      !is.na(padj[path_loci]) & padj[path_loci] < PADJ])

    # cellular-site strip (compartment colours + legend)
    pcomp <- ggplot(hd, aes(1, y, fill = comp)) + geom_tile(color = "white", linewidth = 0.2) +
      scale_fill_manual(values = COMP_PAL, drop = FALSE, guide = "none") +
      scale_y_continuous(expand = c(0, 0)) + scale_x_continuous(expand = c(0, 0)) +
      labs(title = "site") + theme_minimal(base_size = 6) +
      theme(axis.title = element_blank(), axis.text = element_blank(),
            panel.grid = element_blank(), plot.title = element_text(size = 6),
            legend.key.size = unit(7, "pt"), legend.text = element_text(size = 5.5),
            legend.title = element_text(size = 6))
    # log2FC strip (+ gene labels on the right)
    pheat <- ggplot(hd, aes(1, y, fill = v)) + geom_tile(color = "white", linewidth = 0.2) +
      scale_fill_gradient2(low = LOW, mid = "white", high = HIGH, midpoint = 0,
                           limits = c(-hmx, hmx), guide = "none") +
      scale_y_continuous(breaks = hd$y, labels = hd$lab, position = "right", expand = c(0, 0)) +
      scale_x_continuous(expand = c(0, 0)) +
      labs(title = paste0("sig loci (n=", nsig_total, ")")) +
      theme_minimal(base_size = 6) +
      theme(axis.title = element_blank(), axis.text.x = element_blank(),
            panel.grid = element_blank(), axis.text.y = element_text(size = 5),
            plot.title = element_text(size = 7),
            legend.key.size = unit(7, "pt"), legend.text = element_text(size = 5.5),
            legend.title = element_text(size = 6))
    fig <- pmap + pcomp + pheat + plot_layout(widths = c(4.3, 0.35, 1))
  } else fig <- pmap

  h <- max(4, min(0.14 * length(sig) + 4, 9))
  ggsave(file.path(PANELS, paste0(acc, "_", pid, ".png")), fig, width = 12, height = h, dpi = 150, bg = "white")
  done <- done + 1
  cat(acc, pid, nm, "\n")
}
cat("\n", done, "ggkegg panels written\n")
