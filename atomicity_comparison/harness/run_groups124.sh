#!/bin/bash
: "${ATOMICITY_LOGS_DIR:?set ATOMICITY_LOGS_DIR to the directory that will hold run_* output}"
# Groups 1, 2, 4 — all rep-UP conditions. Run sequentially; each line captured.
cd "$(dirname "$0")"
R(){ echo "===== $1 ====="; shift; node run.js "$@" 2>&1 | tail -2; }

echo "######## GROUP 1 — baseline N=1000 ########"
echo "--- G1 bench twotx ---"; node bench.js --mode=twotx --n=1000 --conc=20 --rated=fb_tt 2>&1 | tee $ATOMICITY_LOGS_DIR/final_bench_twotx.json | python3 -c "import sys,json;d=json.load(sys.stdin);print('twotx seq mean',round(d['sequential']['mean'],1),'p50',d['sequential']['p50'],'p95',d['sequential']['p95'],'| TPS',round(d['concurrent']['tps'],1),'mvcc',d['concurrent']['mvcc'],'/',d['n'])"
echo "--- G1 bench unified ---"; node bench.js --mode=unified --n=1000 --conc=20 --rated=fb_un 2>&1 | tee $ATOMICITY_LOGS_DIR/final_bench_unified.json | python3 -c "import sys,json;d=json.load(sys.stdin);print('unified seq mean',round(d['sequential']['mean'],1),'p50',d['sequential']['p50'],'p95',d['sequential']['p95'],'| TPS',round(d['concurrent']['tps'],1),'mvcc',d['concurrent']['mvcc'],'/',d['n'])"

echo "######## GROUP 2 — client-crash N=2000 ########"
R "G2 A window seq"      --mode=twotx  --policy=window --n=2000 --hold=80 --conc=1  --rated=fg2_aws --label=FG2_A_window_seq
R "G2 A window conc=10"  --mode=twotx  --policy=window --n=2000 --hold=80 --conc=10 --rated=fg2_awc --label=FG2_A_window_conc
R "G2 A random seq"      --mode=twotx  --policy=random --n=2000 --hold=80 --rmin=0 --rmax=260 --conc=1  --rated=fg2_ars --label=FG2_A_random_seq
R "G2 A random conc=10"  --mode=twotx  --policy=random --n=2000 --hold=80 --rmin=0 --rmax=260 --conc=10 --rated=fg2_arc --label=FG2_A_random_conc
R "G2 B window seq"      --mode=unified --policy=window --n=2000 --conc=1  --rated=fg2_bws --label=FG2_B_window_seq
R "G2 B random seq"      --mode=unified --policy=random --n=2000 --rmin=0 --rmax=160 --conc=1  --rated=fg2_brs --label=FG2_B_random_seq
R "G2 B random conc=10"  --mode=unified --policy=random --n=2000 --rmin=0 --rmax=160 --conc=10 --rated=fg2_brc --label=FG2_B_random_conc

echo "######## GROUP 4 — event-type generalization, window, N=300 ########"
# (eventType, dimension, append): MC/compliance/0 , PRINT_COMPLETION/quality/1 , DELIVERY/delivery/1
R "G4 A MC/compliance"     --mode=twotx  --policy=window --n=300 --hold=80 --conc=1 --rated=fg4_amc --label=FG4_A_matcert     --evt=MATERIAL_CERTIFICATION --dim=compliance --append=0
R "G4 A PRINT/quality"     --mode=twotx  --policy=window --n=300 --hold=80 --conc=1 --rated=fg4_apr --label=FG4_A_print       --evt=PRINT_COMPLETION       --dim=quality    --append=1
R "G4 A DELIVERY/delivery" --mode=twotx  --policy=window --n=300 --hold=80 --conc=1 --rated=fg4_adl --label=FG4_A_delivery    --evt=DELIVERY               --dim=delivery   --append=1
R "G4 B MC/compliance"     --mode=unified --policy=window --n=300 --conc=1 --rated=fg4_bmc --label=FG4_B_matcert  --evt=MATERIAL_CERTIFICATION --dim=compliance --append=0
R "G4 B PRINT/quality"     --mode=unified --policy=window --n=300 --conc=1 --rated=fg4_bpr --label=FG4_B_print    --evt=PRINT_COMPLETION       --dim=quality    --append=0
R "G4 B DELIVERY/delivery" --mode=unified --policy=window --n=300 --conc=1 --rated=fg4_bdl --label=FG4_B_delivery --evt=DELIVERY               --dim=delivery   --append=0
echo "GROUPS124_DONE"
