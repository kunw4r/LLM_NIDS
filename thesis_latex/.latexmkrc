# .latexmkrc — Standalone chapter compilation support
#
# Use -cd flag with latexmk for standalone chapter compilation:
#   latexmk -pdf -cd ch1_introduction/chapter.tex
#
# The -cd flag changes to the file's directory before compiling,
# which ensures ../main.tex resolves correctly for subfiles.

# Use pdflatex
$pdf_mode = 1;

# Ensure biber runs
$biber = 'biber %O %S';
