OPTION DIALECT HP
OPTION BASE 0:REM I GUESS HP HAS ZERO BASE???
1 REM***STAR TRADER FROM
2 REM***http://www.dunnington.info/public/basicgames/
3 REM***2 chain files merged and ported to 8bitworkshop
10000 RANDOMIZE
10010 DIM S[12,15],T[12,12],T$[72],B[3,12]
10020 REM COM W,D9,K9,X9,D1,X1,P9,T9,S9,Y9,H
10030 DIM M[6,3],C[6,3]:REM COM Y1,R9,G9,Q
10035 REM COM S1,T1,R
10040 REM *** STAR TRADERS ***
10050 REM <<<GAME SET-UP MODULE>>>
10060 REM S IS THE STAR SYSTEM INFO ARRAY
10070 REM T IS THE TRADING SHIP INFO ARRAY
10080 REM T$ IS THE TRADING SHIP NAME STRING
10090 REM M AND C DETERMINE A STAR'S PRODUCTIVITY/MONTH
10092 REM   PROD/MO. = S(7,J) * M(I,R1)  +  C(I,R1)
10094 REM   WHERE J IS THE STAR ID #,I THE MERCHANDISE #,
10096 REM   AND R1 IS THE DEVELOPMENT CLASS OF THE STAR
10100 REM B CONTAINS THE BANK ACCOUNTS
10110 REM A$ IS THE STANDARD INPUT BUFFER
10120 DIM A$[6]
10130 REM R9 IS THE SPEED OF A SHIP IN LIGHT-YEARS PER DAY
10140 REM D9 IS THE MINIMUM  DISTANCE ALLOWED BETWEEN STARS
10150 REM Q IS THE PROBABILITY OF A DELAY
10160 REM K9 IS THE MAX NUMBER OF BIDDING ROUNDS
10170 REM W IS THE MAX WEIGHT OF A TRADING SHIP
10180 REM X9 CONTROLS THE PROFIT MARGIN; HIGH X9 LIMITS THE %
10190 REM G9 IS THE STELLAR DEVELOPMENT INCREMENT 1<=G9<=5
10195 REM R=1 IF THIS IS A RESTART
10200 LET R9=2/7
10210 LET D9=15
10220 LET Q=.1
10230 LET K9=3
10240 LET W=30
10250 LET X9=36
10260 LET G9=1.25
10265 LET R=0
10270 REM D1 IS THE DAY OF THIS YEAR (1<=D1<=360)
10280 REM Y1 IS THIS YEAR
10290 LET D1=1
10300 LET Y1=2070
10302 REM SET UP ECONOMETRICS MODEL
10304 RESTORE 12410
10306 REM MAT READ M,C
10307 FOR I=1 TO 6:FOR J=1 TO 3:READ M[I,J]:NEXT J:NEXT I
10308 FOR I=1 TO 6:FOR J=1 TO 3:READ C[I,J]:NEXT J:NEXT I
10310 REM *** BLOCK #1
10320 PRINT "INSTRUCTIONS (TYPE 'Y' OR 'N' PLEASE)";
10330 INPUT A$
10340 IF A$[1,1]="N" THEN 10590
10350 PRINT 
10360 PRINT "     THE DATE IS JAN 1, 2070 AND INTERSTELLAR FLIGHT"
10370 PRINT "HAS EXISTED FOR 70 YEARS.  THERE ARE SEVERAL STAR"
10380 PRINT "SYSTEMS THAT HAVE BEEN COLONIZED.  SOME ARE ONLY"
10390 PRINT "FRONTIER SYSTEMS, OTHERS ARE OLDER AND MORE DEVELOPED."
10400 PRINT 
10410 PRINT "     EACH OF YOU IS THE CAPTAIN OF TWO INTERSTELLAR"
10420 PRINT "TRADING SHIPS.  YOU WILL TRAVEL FROM STAR SYSTEM TO"
10430 PRINT "STAR SYSTEM, BUYING AND SELLING MERCHANDISE.  IF YOU"
10440 PRINT "DRIVE A GOOD BARGAIN YOU CAN MAKE LARGE PROFITS."
10450 PRINT 
10460 PRINT "     AS TIME GOES ON, EACH STAR SYSTEM WILL SLOWLY"
10470 PRINT "GROW, AND ITS NEEDS WILL CHANGE.  A STAR SYSTEM THAT"
10480 PRINT "HOW IS SELLING MUCH URANIUM AND RAW METALS CHEAPLY"
10490 PRINT "MAY NOT HAVE ENOUGH FOR EXPORT IN A FEW YEARS."
10500 PRINT 
10510 PRINT "     YOUR SHIPS CAN TRAVEL ABOUT TWO LIGHTYEARS IN A"
10520 PRINT "WEEK AND CAN CARRY UP TO";W;" TONS OF CARGO.  ONLY"
10530 PRINT "CLASS I AND CLASS II STAR SYSTEMS HAVE BANKS ON THEM."
10540 PRINT "THEY PAY 5% INTEREST AND ANY MONEY YOU DEPOSIT ON ONE"
10550 PRINT "PLANET IS AVAILABLE ON ANOTHER - PROVIDED THERE'S A LOCAL"
10560 PRINT "BANK."
10570 PRINT 
10580 REM *** BLOCK #2
10590 PRINT "HAVE ALL PLAYERS PLAYED BEFORE";
10600 INPUT A$
10605 PRINT 
10610 IF A$[1,1]="Y" THEN 10630
10620 GOTO 10660
10630 PRINT "DO YOU WANT TO SET UP YOUR OWN GAME";
10640 INPUT A$
10645 PRINT 
10650 IF A$[1,1]="Y" THEN 10760
10660 PRINT "HOW MANY PLAYERS";
10670 INPUT P9
10675 PRINT 
10680 GOTO P9-1 OF 10710,10710,10710
10690 PRINT "2,3, OR 4 CAN PLAY"
10700 GOTO 10660
10710 T9=2*P9
10720 S9=3*P9+1
10730 Y9=Y1+5
10740 GOTO 11350
10750 REM *** BLOCK #3
10760 PRINT "IS THIS A RESTART";
10770 INPUT A$
10775 PRINT 
10780 IF A$[1,1]="N" THEN 10940
10790 PRINT "LOAD THE TAPE INTO THE TAPE READER.  WHEN I TYPE A '?'"
10800 PRINT "YOU CAN FLIP THE SWITCH TO 'START' WHENEVER YOU'RE READY"
10810 PRINT 
10820 INPUT T$
10830 INPUT W,D9,K9,X9,D1,Y1
10835 INPUT P9,T9,S9,Y9,T1,S1
10840 FOR J=1 TO S9
10845 FOR I=1 TO 9 STEP 4
10850 INPUT S[I,J],S[I+1,J],S[I+2,J],S[I+3,J]
10855 NEXT I
10860 NEXT J
10870 FOR J=1 TO T9
10875 FOR I=1 TO 9 STEP 4
10880 INPUT T[I,J],T[I+1,J],T[I+2,J],T[I+3,J]
10885 NEXT I
10890 NEXT J
10900 FOR I=1 TO P9
10910 INPUT B[1,I],B[2,I],B[3,I]
10920 NEXT I
10925 R=1
10930 GOSUB 20000:REM CALL TRADES ROUTINE
10940 PRINT "HOW MANY PLAYERS";
10950 INPUT P9
10955 PRINT 
10960 IF P9 >= 2 AND P9 <= 12 THEN 10990
10970 PRINT "2,3,4, ... ,12 CAN PLAY"
10980 GOTO 10940
10990 PRINT "HOW MANY SHIPS PER PLAYER";
11000 INPUT X
11005 PRINT 
11010 IF X<1 THEN 10990
11020 T9=P9*X
11030 IF T9 <= 12 THEN 11070
11040 PRINT "I CAN'T KEEP TRACK OF MORE THAN 12 SHIPS;"
11050 PRINT P9;" PLAYERS TIMES";X;" SHIPS MAKES";T9
11060 GOTO 10990
11070 PRINT "HOW MANY STAR SYSTEMS";
11080 INPUT S9
11085 PRINT 
11090 IF S9 >= 4 AND S9 <= 13 THEN 11120
11100 PRINT "FROM 4 TO 13 STARS"
11110 GOTO 11070
11120 PRINT "ENTER THE LENGTH OF GAME IN YEARS";
11130 INPUT X
11135 PRINT 
11140 IF X >= 1 AND INT(X)=X THEN 11170
11150 PRINT "CHOOSE A POSITIVE INTEGER"
11160 GOTO 11130
11170 Y9=Y1+X
11180 PRINT "WHAT'S THE MAX CARGOE TONNAGE(USUALLY 30)";
11190 INPUT W
11195 PRINT 
11200 IF W<25 THEN 11180
11210 PRINT "WHAT'S THE MINIMUM DISTANCE BETWEEN STARS(USUALLY 15)";
11220 INPUT D9
11225 PRINT 
11230 IF D9 <= 25 AND D9 >= 10 THEN 11260
11240 PRINT "MIN SPACING 10, MAX 25"
11250 GOTO 11210
11260 PRINT "HOW MANY BIDS OR OFFERS(USUALLY 3)";
11270 INPUT K9
11275 PRINT 
11280 IF K9<1 THEN 11260
11290 PRINT "SET THE PROFIT MARGIN(1,2,3,4 OR 5)...THE HIGHER"
11300 PRINT "THE NUMBER, THE LOWER THE PROFIT % ... USUALLY SET TO 2"
11310 PRINT "...YOUR NUMBER";
11320 INPUT X9
11330 X9=18*(ABS(X9) MIN 5)
11340 REM *** BLOCK #4.1
11350 S[11,1]=S[12,1]=0
11360 S[7,1]=15
11370 REM *** BLOCK #4.2
11380 H=1
11390 S1=2
11400 GOSUB 11920
11410 S1=3
11420 GOSUB 11920
11430 S1=4
11440 GOSUB 12010
11450 FOR S1=5 TO S9
11460 GOSUB S1-3*INT((S1-1)/3) OF 11920,12010,12060
11470 NEXT S1
11480 REM *** BLOCK #4.3
11490 FOR S1=1 TO S9
11500 FOR J=1 TO 6
11510 S[J,S1]=0
11520 NEXT J
11530 IF S1>1 THEN 11560
11540 I=1
11550 GOTO 11600
11560 I=4*INT(14*RND(0))+5
11570 FOR J=2 TO S1-1
11580 IF I=S[8,J] THEN 11560
11590 NEXT J
11600 S[8,S1]=I
11610 S[9,S1]=270
11620 S[10,S1]=Y1-1
11630 NEXT S1
11640 REM *** BLOCK #4.4
11650 T1=1:L=1
11655 PRINT 
11657 PRINT 
11660 PRINT "CAPTAINS, NAME YOUR SHIPS (UP TO 6 LETTERS/BLANKS/NUMBERS)"
11670 FOR I=1 TO T9/P9
11680 PRINT 
11690 FOR P1=1 TO P9
11700 T[1,T1]=T[2,T1]=T[6,T1]=0
11710 T[3,T1]=15
11720 T[4,T1]=T[5,T1]=10
11730 T[7,T1]=25
11740 T[9,T1]=D1
11750 T[10,T1]=Y1
11760 T[11,T1]=5000
11770 PRINT "   CAPTAIN";P1;"WHAT DO YOU CHRISTEN YOUR SHIP #";I;
11780 INPUT T2$:T$[L,L+5]=T2$
11790 T1=T1+1
11800 L=L+6
11810 NEXT P1
11820 NEXT I
11830 REM *** BLOCK #4.5
11840 FOR B1=1 TO P9
11850 B[1,B1]=0
11860 B[2,B1]=D1
11870 B[3,B1]=Y1
11880 NEXT B1
11890 GOSUB 20000:REM CALL TRADES ROUTINE
11900 REM *** GOSUBS FOLLOW ***
11910 REM <FRONTIER> GOSUB
11920 X=(RND(0)-.5)*100
11930 Y=50*RND(0)
11940 IF (ABS(X)<25) AND (Y<25) THEN 11920
11950 F=1
11960 GOSUB 12190
11970 IF F=0 THEN 11920
11980 S[7,S1]=0
11990 RETURN
12000 REM *** <UNDERDEVELOPED> GOSUB
12010 E=100
12020 GOSUB 12110
12030 S[7,S1]=5
12040 RETURN
12050 REM *** <DEVELOPED> GOSUB
12060 E=50
12070 GOSUB 12110
12080 S[7,S1]=10
12090 RETURN
12100 REM *** <GENERATE CO-ORDS> GOSUB
12110 X=(RND(0)-.5)*E
12120 Y=RND(0)*E/2
12130 F=1
12140 GOSUB 12190
12150 IF F=0 THEN 12110
12160 RETURN
12170 REM *** <TEST STAR CO-ORDS> GOSUB
12180 REM FIRST CONVERT CO-ORDS TO NEXT HALF-BOARD
12190 GOTO H OF 12300,12260,12240,12200
12200 Z=X
12210 X=-Y
12220 Y=Z
12230 GOTO 12300
12240 Y=-Y
12250 GOTO 12300
12260 Z=X
12270 X=Y
12280 Y=Z
12290 REM SECOND, TEST PROXIMITY
12300 FOR J=1 TO S1-1
12310 IF SQR((X-S[11,J])^2+(Y-S[12,J])^2) >= D9 THEN 12340
12320 F=0
12330 RETURN
12340 NEXT J
12350 REM FINALLY, ENTER CO-ORDS AND INCREMENT HALF-BOARD CTR
12360 S[11,S1]=INT(X)
12370 S[12,S1]=INT(Y)
12380 H=1+(H <= 3)*H
12390 RETURN
12400 REM *** DATA FOR ECONOMETRIC MODEL FOLLOWS ***
12410 REM MODEL #1
12420 DATA -0.025,-0.05,-0.025,0,-0.025,-0.025,0,.1,.1,-0.025,.1,0,.1,.2,.1,.1,-0.025,0
12430 DATA 1,1.5,.5,.75,.75,.75,-0.25,-0.25,-0.25,0,-0.5,.5,0,-0.5
12440 DATA 0,.5,1.5,0
12450 END

20000 REM *** TRADES SUBROUTINE (NO CHAIN)
20040 REM *** STAR TRADERS ***
20050 REM MAIN MODULE
20120 REM SET UP CALENDAR AND STAR SYSTEM NAMES
20130 DIM C$[36],S$[60]
20140 LET C$="JANFEBMARAPRMIYJUNJULAUGSEPOCTNOVDEC"
20150 LET S$="SOL YORKBOYDIVANREEFHOOKSTANTASKSINKSANDQUINGAOLKIRKKRISFATE"
20160 REM SEH: removed LET S$[53]="KRISFATE" b/c append doesn't work
20170 REM S IS THE STAR SYSTEM INFO ARRAY
20180 REM T IS THE TRADING SHIP INFO ARRAY
20190 REM T$ IS THE TRADING SHIP NAME STRING (6 CHARS PER SHIP)
20200 REM P CONTAINS THE FAIR PRICES ON THE LOCAL PLANET
20210 REM Q HAS THE FIXED PRICES
20220 REM B CONTAINS THE BANK ACCOUNTS
20230 DIM P[6],Q[6]
20240 DIM A$[6],D$[5],N$[36],G[6]
20250 RESTORE 20270
20260 REM MAT READ Q
20265 FOR I=1 TO 6:READ Q(I):NEXT I
20270 DATA 5000,3500,4000,4500,3000,3000
20280 LET N$="    UR   MET    HE   MED  SOFT  GEMS"
20290 REM FNZ COMPUTES THE PRICE WINDOW THROUGH WHICH A BID IS
20300 REM ACCEPTABLE FOR FURTHER HAGGLING
20310 DEF FNZ(X)=(FNY(X)*.5+( NOT FNY(X))*X/(2*ABS(S[I1,S1])))/K1
20320 DEF FNY(X)=X >= ABS(S[I1,S1])
20330 REM R9 IS THE SPEED OF A SHIP IN LIGHTYEARS PER DAY
20340 REM D9 IS THE MINIMUM DISTANCE ALLOWED BETWEEN STARS
20350 REM Q IS THE PROBABILITY OF A DELAY
20360 REM K9 IS THE MAX NUMBER OF BIDDING ROUNDS
20370 REM W IS THE MAX WEIGHT OF A TRADING SHIP'S CARGO
20380 REM X9 CONTROLS THE PROFIT MARGIN; HIGH X9 LIMITS THE %
20390 REM G9 IS THE STELLAR DEVELOPEMENT # INCREMENT 1<=G9<=5
20400 REM *** BLOCK #5
20402 IF R=0 THEN 20430
20404 GOSUB 23860
20406 GOSUB 25190
20408 FOR T2=1 TO T9
20410 IF T2=T1 THEN 20420
20412 L=(T2-1)*6+1
20414 PRINT T$[L,L+5];" IS ENROUTE TO ";S$[T[8,T2],T[8,T2]+3]
20420 NEXT T2
20424 L=(T1-1)*6+1
20426 PRINT " AND ";T$[L,L+5];" IS ABOUT TO LEAVE ";S$[T[8,T1],T[8,T1]+3]
20428 GOTO 22040
20430 GOSUB 25190
20432 GOSUB 23190
20434 S1=T1=L1=1
20440 PRINT 
20450 PRINT "ALL SHIPS START AT SOL"
20460 PRINT "ADVICE;  VISIT THE CLASS III AND IV SYSTEMS -"
20470 PRINT "SOL AND THE CLASS II STARS PRODUCE ALOT OF HE,MED AND"
20480 PRINT "SOFT, WHICH THE POORER STAR SYSTEMS (CLASS III AND"
20490 PRINT "IV) NEED.  ALSO, THE POOR STARS PRODUCE THE RAW GOODS -"
20500 PRINT "UR,MET,GEMS THAT YOU CAN BRING BACK TO SOL AND"
20510 PRINT "THE CLASS II SYSTEMS IN TRADE"
20520 PRINT 
20530 PRINT "STUDY THE MAP AND CURRENT PRICE CHARTS CAREFULLY -"
20540 PRINT "CLASS I AND II STARS MAKE EXCELLENT TRADING PARTNERS"
20550 PRINT "WITH CLASS III OR IV STARS."
20560 FOR I1=1 TO T9/P9
20570 FOR P1=1 TO P9
20580 PRINT 
20590 PRINT "PLAYER";P1;", WHICH STAR WILL ";T$[L1,L1+5];" TRAVEL TO";
20600 GOSUB 22770
20610 L1=L1+6
20620 T1=T1+1
20630 NEXT P1
20640 NEXT I1
20650 REM *** BLOCK #6
20660 D=T[9,1]
20670 Y=T[10,1]
20680 T1=1
20690 FOR I=2 TO T9
20700 IF T[10,I]<Y THEN 20740
20710 IF T[10,I]>Y THEN 20770
20720 IF T[9,I]>D THEN 20770
20730 IF T[9,I]=D AND RND(0)>.5 THEN 20770
20740 D=T[9,I]
20750 Y=T[10,I]
20760 T1=I
20770 NEXT I
20780 IF Y1=Y THEN 20900
20790 D1=1
20800 Y1=Y
20810 T2=T1
20820 GOSUB 23190
20822 IF Y1 <> 2071 THEN 20830
20824 GOSUB 24500
20826 PRINT "THE LAST YEAR OF THIS GAME IS ";Y9;" BUT IF YOU"
20828 PRINT "WANT TO QUIT BEFORE THEN, YOU CAN TYPE 'SAVE' AS"
20829 PRINT "YOUR NEXT PORT OF CALL - THIS WILL PUNCH A TAPE"
20830 PRINT "SO YOU CAN CONTINUE THE GAME LATER"
20831 T1=T2
20840 IF Y1<Y9 THEN 22900
20850 GOSUB 24500
20860 PRINT "NEW GAME";
20870 INPUT A$
20880 IF A$[1,1]="N" THEN 25500
20890 RETURN:REM CHAIN "$TRADER"
20900 D1=D
20910 M=INT((D1-1)/30)
20920 L=3*M+1
20930 PRINT 
20940 PRINT 
20950 PRINT "*****************"
20960 PRINT "* ";C$[L,L+2];D1-30*M;",";Y1
20970 L=(T1-1)*6+1
20980 S1=T[8,T1]
20990 M=S[8,S1]
21000 PRINT "* ";T$[L,L+5];" HAS LANDED ON ";S$[M,M+3]
21010 GOTO T[12,T1]+1 OF 21080,21060,21040,21020
21020 PRINT "3 WEEKS LATE - PIRATES ATTACKED MIDVOYAGE"
21030 GOTO 21080
21040 PRINT "2 WEEKS LATE - 'WE GOT LOST.SORRY'"
21050 GOTO 21080
21060 PRINT "1 WEEK LATE - 'OUR COMPUTER MADE A MISTAKE'"
21070 REM *** PRINT CARGO STATUS FOR CURRENT SHIP
21080 PRINT 
21090 PRINT "$ ON BOARD";N$;"  NET WT"
21100 REM PRINT USING "DDXDDDXDDD,7(4X,2D)";T[11,T1],T[1,T1],T[2,T1],T[3,T1],T[4,T1],T[5,T1],T[6,T1],T[7,T1]
21105 PRINT NFORMAT$(T[11,T1],10);
21106 PRINT NFORMAT$(T[1,T1],6);:PRINT NFORMAT$(T[2,T1],6);
21107 PRINT NFORMAT$(T[3,T1],6);:PRINT NFORMAT$(T[4,T1],6);
21108 PRINT NFORMAT$(T[5,T1],6);:PRINT NFORMAT$(T[6,T1],6);
21109 PRINT NFORMAT$(T[7,T1],6)
21110 REM IMAGE  
21120 REM *** BLOCK #7
21130 GOSUB 23870
21140 PRINT 
21150 PRINT "WE ARE BUYING:"
21160 J1=1
21170 FOR I1=1 TO 6
21180 IF S[I1,S1] >= 0 OR T[I1,T1]<.5 THEN 21480
21190 PRINT TAB(5);N$[J1,J1+5];" WE NEED ";-INT(S[I1,S1]);" UNITS.";
21200 PRINT "HOW MANY ARE YOU SELLING";
21210 GOSUB 24430
21220 IF X=0 THEN 21480
21230 IF X <= T[I1,T1] THEN 21270
21240 PRINT TAB(5);"YOU ONLY HAVE ";T[I1,T1];" UNITS IN YOUR HOLD"
21250 PRINT TAB(5);
21260 GOTO 21200
21270 IF X <= 2*-INT(S[I1,S1]) THEN 21300
21280 X=2*-INT(S[I1,S1])
21290 PRINT TAB(5);"WE'LL BID ON ";X;" UNITS."
21300 FOR K1=1 TO K9
21310 IF K1#K9 MAX 2 THEN 21340
21320 PRINT TAB(5);"OUR FINAL OFFER:";
21330 GOTO 21350
21340 PRINT TAB(5);"WE OFFER ";
21342 Y2=(L1+1)*10/3
21350 PRINT 100*INT(.009*P[I1]*X+.5);" WHAT DO YOU BID";
21360 INPUT Y
21362 IF Y>P[I1]*X/10 AND Y<P[I1]*X*10 THEN 21370
21364 PRINT TAB(5);"WATCH YOUR TYPING -- TRY AGAIN"
21366 GOTO 21340
21370 IF Y <= P[I1]*X THEN 21430
21380 IF Y>(1+FNZ(X))*P[I1]*X THEN 21410
21390 P[I1]=.8*P[I1]+.2*Y/X
21400 NEXT K1
21410 PRINT TAB(5);"WE'LL PASS THIS ONE"
21420 GOTO 21480
21430 PRINT TAB(5);"WE'LL BUY!"
21440 T[I1,T1]=T[I1,T1]-X
21450 T[7,T1]=T[7,T1]-X*(I1<5)
21460 T[11,T1]=T[11,T1]+Y
21470 S[I1,S1]=S[I1,S1]+X
21480 J1=J1+6
21490 NEXT I1
21500 PRINT 
21510 REM *** BLOCK #8
21520 PRINT "WE ARE SELLING:"
21530 J1=1
21540 FOR I1=1 TO 6
21550 IF G[I1] <= 0 OR S[I1,S1]<1 THEN 21960
21555 IF I1 <= 4 AND T[7,T1] >= W THEN 21960
21560 PRINT TAB(5);N$[J1,J1+5];" UP TO ";INT(S[I1,S1]);" UNITS.";
21570 PRINT "HOW MANY ARE YOU BUYING";
21580 GOSUB 24430
21590 IF X=0 THEN 21960
21600 IF I1>4 OR X+T[7,T1] <= W THEN 21660
21610 PRINT TAB(5);"YOU HAVE ";T[7,T1];" TONS ABOARD, SO ";X;
21620 PRINT " TONS PUTS YOU OVER"
21630 PRINT TAB(5);"THE ";W;" TON LIMIT."
21640 PRINT TAB(5);
21650 GOTO 21570
21660 IF X <= S[I1,S1] THEN 21700
21670 PRINT TAB(5);"WE ONLY HAVE ";INT(S[I1,S1]);" UNITS"
21680 PRINT TAB(5);
21690 GOTO 21570
21700 FOR K1=1 TO K9
21710 IF K1#K9 MAX 2 THEN 21740
21720 PRINT TAB(5);"OUR FINAL OFFER:";
21730 GOTO 21750
21740 PRINT TAB(5);"WE WANT ABOUT ";
21750 PRINT 100*INT(.011*P[I1]*X+.5);
21760 PRINT "YOUR OFFER";
21770 INPUT Y
21772 IF Y>P[I1]*X/10 AND Y<P[I1]*X*10 THEN 21780
21774 PRINT TAB(5);"WATCH YOUR TYPING -- TRY AGAIN"
21776 GOTO 21740
21780 IF Y >= P[I1]*X THEN 21840
21790 IF Y<(1-FNZ(X))*P[I1]*X THEN 21820
21800 P[I1]=.8*P[I1]+.2*Y/X
21810 NEXT K1
21820 PRINT TAB(5);"THAT'S TOO LOW"
21830 GOTO 21960
21840 IF Y <= T[11,T1] THEN 21910
21850 PRINT TAB(5);"YOU BID $";Y;" BUT YOU HAVE ONLY $";T[11,T1]
21860 GOSUB 24310
21870 IF S[7,S1]<10 OR T[11,T1]+B[1,B1]<Y THEN 21820
21880 PRINT TAB(5);
21890 GOSUB 24020
21900 IF Y>T[11,T1] THEN 21820
21910 PRINT TAB(5);"SOLD!"
21920 T[I1,T1]=T[I1,T1]+X
21930 T[7,T1]=T[7,T1]+X*(I1<5)
21940 S[I1,S1]=S[I1,S1]-X
21950 T[11,T1]=T[11,T1]-Y
21960 J1=J1+6
21970 NEXT I1
21980 REM *** BLOCK #9
21990 GOSUB 24310
22000 IF S[7,S1]<10 OR T[11,T1]+B[1,B1]=0 THEN 22040
22010 PRINT 
22020 GOSUB 24020
22030 PRINT 
22040 PRINT "WHAT IS YOUR NEXT PORT OF CALL";
22050 GOSUB 22770
22060 REM *** BLOCK #10.1
22070 J=0
22080 FOR I=1 TO 6
22090 IF S[I,S1] >= 0 THEN 22120
22100 IF S[I,S1]<G[I] THEN 20660
22110 J=J+1
22120 NEXT I
22130 IF J>1 THEN 20660
22140 REM *** BLOCK #10.2
22150 S[7,S1]=S[7,S1]+G9
22160 G0=S[7,S1]
22162 IF G0#5 AND G0#10 AND G0#15 THEN 22220
22170 GOSUB 24580
22180 GOSUB 24500
22190 PRINT "STAR SYSTEM ";S$[S[8,S1],S[8,S1]+3];" IS NOW A CLASS";
22200 PRINT D$;" SYSTEM"
22210 REM *** BLOCK #10.3
22220 IF S9=15 THEN 20660
22230 J=0
22240 FOR I=1 TO S9
22250 J=J+S[7,I]
22260 NEXT I
22270 IF J/S9<10 THEN 20660
22280 REM A NEW STAR IS BORN!
22290 S1=S9=S9+1
22300 GOSUB 24680
22310 GOSUB 22450
22320 S[9,S1]=D1
22330 S[10,S1]=Y1
22340 FOR J=1 TO 6
22350 S[J,S1]=0
22360 NEXT J
22370 GOSUB 24500
22380 PRINT "A NEW STAR SYSTEM HAS BEEN DISCOVERED!  IT IS A CLASS IV"
22390 PRINT "AND ITS NAME IS";S$[S[8,S1],S[8,S1]+3]
22400 GOSUB 25190
22410 GOTO 20660
22420 STOP
22430 REM *** GOSUBS FOLLOW ***
22440 REM <FRONTIER> GOSUB
22450 X=(RND(0)-.5)*100
22460 Y=50*RND(0)
22470 IF (ABS(X)<25) AND (Y<25) THEN 22450
22480 F=1
22490 GOSUB 22550
22500 IF F=0 THEN 22450
22510 S[7,S1]=0
22520 RETURN
22530 REM *** <TEST STAR CO-ORDS> GOSUB
22540 REM FIRST CONVERT CO-ORDS TO NEXT HALF-BOARD
22550 GOTO H OF 22660,22620,22600,22560
22560 Z=X
22570 X=-Y
22580 Y=Z
22590 GOTO 22660
22600 Y=-Y
22610 GOTO 22660
22620 Z=X
22630 X=Y
22640 Y=Z
22650 REM SECOND TEST PROXIMITY
22660 FOR J=1 TO S1-1
22670 IF SQR((X-S[11,J])^2+(Y-S[12,J])^2) >= D9 THEN 22700
22680 F=0
22690 RETURN
22700 NEXT J
22710 REM FINALLY ENTER CO-ORDS AND INCREMENT HALF-BOARD COUNTER
22720 S[11,S1]=INT(X)
22730 S[12,S1]=INT(Y)
22740 H=1+(H <= 3)*H
22750 RETURN
22760 REM *** <NEXT ETA> GOSUB
22770 INPUT A$
22780 FOR I=1 TO S9
22790 J=S[8,I]
22800 IF A$[1,4]=S$[J,J+3] THEN 22870
22810 NEXT I
22820 IF A$[1,4] <> "SAVE" THEN 22832
22830 GOSUB 24770
22832 IF A$[1,3] <> "MAP" THEN 22840
22833 S2=S1
22834 GOSUB 25190
22835 S1=S2
22836 GOTO 22850
22840 IF A$[1,6] <> "REPORT" THEN 22848
22842 GOSUB 23180
22846 GOTO 22850
22848 PRINT A$[1,4];" IS NOT A STAR NAME IN THIS GAME"
22850 PRINT "NEXT STAR";
22860 GOTO 22770
22870 T[8,T1]=I
22880 IF I#S1 THEN 22910
22890 PRINT "CHOOSE A DIFFERENT STAR SYSTEM TO VISIT"
22900 GOTO 22850
22910 D2=SQR((S[11,S1]-S[11,I])^2+(S[12,S1]-S[12,I])^2)/R9
22920 D2=INT(D2)
22930 IF RND(0)>(Q/2) THEN 23030
22940 I=1+INT(RND(0)*3)
22950 GOTO I OF 23000,22980,22960
22960 PRINT "SHIP DOES NOT PASS INSPECTION";
22970 GOTO 23010
22980 PRINT "CREWMEN DEMAND A VACATION";
22990 GOTO 23010
23000 PRINT "LOCAL HOLIDAY SOON";
23010 PRINT " - ";I;" WEEK DELAY."
23020 D2=D2+7*I
23030 T[9,T1]=T[9,T1]+D2
23040 IF T[9,T1] <= 360 THEN 23070
23050 T[9,T1]=T[9,T1]-360
23060 T[10,T1]=T[10,T1]+1
23070 M=INT((T[9,T1]-1)/30)
23080 L=3*M+1
23090 PRINT "THE ETA AT ";S$[J,J+3];" IS ";C$[L,L+2];" ";T[9,T1]-30*M;","T[10,T1]
23100 REM UPDATE ETA PLUS RANOM DELAY FACTOR (0,1,2 OR 3 WEEKS)
23110 I=(INT(RND(0)*3)+1)*(RND(0)>(Q/2))
23120 T[9,T1]=T[9,T1]+7*I
23130 IF T[9,T1] <= 360 THEN 23160
23140 T[9,T1]=T[9,T1]-360
23150 T[10,T1]=T[10,T1]+1
23160 T[12,T1]=I
23170 RETURN
23180 REM *** <REPORT> GOSUB
23190 GOSUB 24500
23200 PRINT TAB(10);"JAN  1, ";Y1;TAB(35);"YEARLY REPORT #";Y1-2069
23210 PRINT 
23220 PRINT 
23230 IF Y1>22070 THEN 23450
23240 PRINT "STAR SYSTEM CLASSES:"
23250 PRINT "     I  COSMOPOLITAN"
23260 PRINT "    II  DEVELOPED"
23270 PRINT "   III  UNDERDEVELOPED"
23280 PRINT "    IV  FRONTIER"
23290 PRINT 
23300 PRINT 
23310 PRINT "MERCHANDISE:"
23320 PRINT "    UR  URANIUM"
23330 PRINT "   MET  METALS"
23340 PRINT "    HE  HEAVY EQUIPMENT"
23350 PRINT "   MED  MEDICINE"
23360 PRINT "  SOFT  COMPUTER SOFTWARE"
23370 PRINT "  GEMS  STAR GEMS"
23380 PRINT 
23390 PRINT 
23400 PRINT TAB(5);"EACH TRADING SHIP CAN CARRY MAX ";W;" TONS CARGO."
23410 PRINT "STAR GEMS AND COMPUTER SOFTWARE, WHICH AREN'T SOLD BY THE"
23420 PRINT "TON, DON'T COUNT."
23430 PRINT 
23440 PRINT 
23450 PRINT TAB(20);"CURRENT PRICES"
23460 PRINT 
23470 PRINT 
23480 PRINT "NAME","CLASS";N$
23490 PRINT 
23500 FOR S1=1 TO S9
23510 GOSUB 23870
23520 FOR I=1 TO 6
23530 P[I]=SGN(S[I,S1])*P[I]
23540 NEXT I
23550 GOSUB 24580
23560 REM PRINT USING "#,4A,2X";S$[S[8,S1],S[8,S1]+3]
23561 PRINT S$[S[8,S1],S[8,S1]+3],
23570 REM PRINT USING "5A,6(S5D)";D$,P[1],P[2],P[3],P[4],P[5],P[6]
23571 PRINT D$;
23572 PRINT NFORMAT$(P[1],6);
23573 PRINT NFORMAT$(P[2],6);
23574 PRINT NFORMAT$(P[3],6);
23575 PRINT NFORMAT$(P[4],6);
23576 PRINT NFORMAT$(P[5],6);
23577 PRINT NFORMAT$(P[6],6)
23580 IF S1/2 <> INT(S1/2) THEN 23600
23590 PRINT 
23600 NEXT S1
23610 PRINT 
23620 PRINT "('+' MEANS SELLING AND '-' MEANS BUYING)"
23630 PRINT 
23640 PRINT 
23650 PRINT TAB(22);"CAPTAINS"
23660 PRINT 
23670 PRINT 
23680 PRINT "NUMBER","$ ON SHIPS","$ IN BANK","CARGOES","TOTALS"
23690 FOR B1=1 TO P9
23700 GOSUB 24380
23710 NEXT B1
23720 FOR P1=1 TO P9
23730 PRINT 
23740 M1=0:M2=0
23750 FOR I1=0 TO T9/P9-1
23760 M1=M1+T[11,P9*I1+P1]
23770 FOR K=1 TO 6
23780 M2=M2+T[K,P9*I1+P1]*Q[K]
23790 NEXT K
23800 NEXT I1
23810 M3=M2+M1+B[1,P1]
23820 REM PRINT USING "2X,2D,2X,4(2X,DDXDDDXDDD)";P1,M1,B[1,P1],M2,M3
23821 PRINT P1,M1,B[1,P1],M2,M3
23830 REM IMAGE  
23840 NEXT P1
23850 RETURN
23860 REM *** <PRICES> GOSUB
23870 R1=1+(S[7,S1] >= 5)+(S[7,S1] >= 10)
23880 D2=12*(Y1-S[10,S1])+(D1-S[9,S1])/30
23890 FOR I=1 TO 6
23900 G[I]=(1+S[7,S1]/15)*(M[I,R1]*S[7,S1]+C[I,R1])
23910 IF ABS(G[I])>.01 THEN 23940
23920 P[I]=0
23930 GOTO 23970
23940 S[I,S1]=SGN(G[I])*(ABS(G[I]*12) MIN ABS(S[I,S1]+D2*G[I]))
23950 P[I]=Q[I]*(1-SGN(S[I,S1])*ABS(S[I,S1]/(G[I]*X9)))
23960 P[I]=100*INT(P[I]/100+.5)
23970 NEXT I
23980 S[9,S1]=D1
23990 S[10,S1]=Y1
24000 RETURN
24010 REM  *** <BANK CALL> GOSUB
24020 PRINT "DO YOU WISH TO VISIT THE LOCAL BANK";
24030 INPUT A$
24040 IF A$[1,1]="Y" THEN 24060
24050 RETURN
24060 GOSUB 24310
24070 GOSUB 24380
24080 PRINT TAB(5);"YOU HAVE $";B[1,B1];" IN THE BANK"
24082 PRINT TAB(5);"AND $";T[11,T1];" ON YOUR SHIP"
24090 IF B[1,B1]=0 THEN 24190
24100 PRINT TAB(5);"HOW MUCH DO YOU WISH TO WITHDRAW";
24110 INPUT Z
24120 IF Z <= B[1,B1] THEN 24150
24130 PRINT TAB(5);"TOO MUCH; ";
24140 GOTO 24100
24150 IF Z <= 0 THEN 24190
24160 B[1,B1]=B[1,B1]-Z
24170 T[11,T1]=T[11,T1]+Z
24180 RETURN
24190 PRINT TAB(5);"HOW MUCH DO YOU WISH TO DEPOSIT";
24200 INPUT Z
24210 IF Z >= 0 THEN 24240
24220 PRINT TAB(5);"YOU CAN'T DEPOSIT A NEGATIVE NUMBER"
24230 GOTO 24190
24240 IF Z <= T[11,T1] THEN 24270
24250 PRINT TAB(5);"YOU HAVE $";T[11,T1];" ON YOUR SHIP"
24260 GOTO 24190
24270 T[11,T1]=T[11,T1]-Z
24280 B[1,B1]=B[1,B1]+Z
24290 RETURN
24300 REM *** <B1> GOSUB
24310 B1=T1
24320 FOR I=1 TO S9/P9
24330 IF B1 <= P9 THEN 24360
24340 B1=B1-P9
24350 NEXT I
24360 RETURN
24370 REM   ***<BANK UPDATE> GOSUB
24380 B[1,B1]=B[1,B1]*(1+.05*(Y1-B[3,B1]+(D1-B[2,B1])/360))
24390 B[2,B1]=D1
24400 B[3,B1]=Y1
24410 RETURN
24420 REM *** <INPUT> GOSUB
24430 INPUT X
24440 IF INT(X)=X AND X >= 0 THEN 24480
24450 PRINT TAB(5);"TYPE A ZERO IF YOU WANT TO PASS THIS ONE,"
24460 PRINT TAB(5);"BUT NO NEGATIVES OR DECIMALS"
24470 GOTO 24430
24480 RETURN
24490 REM *** <GA> GOSUB
24500 PRINT 
24520 PRINT 
24530 PRINT TAB(20),"*** GENERAL ANNOUNCEMENT ***"
24540 PRINT 
24550 PRINT 
24560 RETURN
24570 REM *** <D$> GOSUB
24580 GOTO S[7,S1]/5+1 OF 24650,24630,24610,24590
24590 D$="    I"
24600 RETURN
24610 D$="   II"
24620 RETURN
24630 D$="  III"
24640 RETURN
24650 D$="   IV"
24660 RETURN
24670 REM *** <STAR NAME> GOSUB
24680 IF S1>1 THEN 24710
24690 I=1
24700 GOTO 24750
24710 I=4*INT(14*RND(0))+5
24720 FOR J=2 TO S1-1
24730 IF I=S[8,J] THEN 24710
24740 NEXT J
24750 S[8,S1]=I
24760 RETURN
24770 REM *** <SAVE GAME ON TAPE> GOSUB
24780 PRINT "WHEN I TYPE '?' THIS IS WHAT YOU SHOULD DO:"
24790 PRINT 
24800 PRINT "  1.  PUSH THE 'ON' BUTTON ON THE TAPE PUNCHER"
24810 PRINT "  2.  PRESS THE 'HERE IS' KEY (UPPER RIGHT) 3 TIMES"
24820 PRINT "  3.  PUSH THE 'OFF' BUTTON ON THE TAPE PUNCHER"
24830 PRINT "  4.  TYPE ANY NUMBER"
24840 PRINT "  5.  PRESS THE 'RETURN' KEY"
24850 PRINT 
24860 PRINT "WHEN I TYPE '!!!' THAT MEANS I'LL START PUNCHING"
24870 PRINT "THE TAPE IN ABOUT 10 SECONDS, SO:"
24880 PRINT 
24890 PRINT "   ***   DON'T FORGET TO TURN THE PUNCHER BACK ON   ***"
24900 PRINT LIN(3)
24910 INPUT X
24920 PRINT "!!!"
24930 FOR I=1 TO 10000
24940 X=X+1
24950 NEXT I
24960 PRINT T$;""
24970 PRINT W;",";D9;",";K9;",";X9;",";D1;",";Y1;""
24980 PRINT P9;",";T9;",";S9;",";Y9;",";T1;",";S1;""
24990 FOR J=1 TO S9
25000 FOR I=1 TO 9 STEP 4
25010 PRINT S[I,J];",";S[I+1,J];",";S[I+2,J];",";S[I+3,J];""
25040 NEXT I
25060 NEXT J
25070 FOR J=1 TO T9
25080 FOR I=1 TO 9 STEP 4
25090 PRINT T[I,J];",";T[I+1,J];",";T[I+2,J];",";T[I+3,J];""
25120 NEXT I
25140 NEXT J
25150 FOR I=1 TO P9
25160 PRINT B[1,I];",";B[2,I];",";B[3,I];""
25170 NEXT I
25172 FOR I=1 TO 50
25174 PRINT " ";
25176 NEXT I
25180 STOP
25190 REM *** <PRINT STAR MAP> GOSUB
25200 PRINT LIN(3)
25210 PRINT TAB(22);"STAR MAP"
25220 PRINT TAB(20);"************"
25230 PRINT 
25240 DIM L$[55]
25250 FOR L1=15 TO -15 STEP -1
25260 IF L1 <> 0 THEN 25290
25270 L$="1----1----1----1----1----*SOL-1----1----1----1----1    "
25280 GOTO 25340
25290 L$="                                                       "
25300 IF ABS(L1)/3=INT(ABS(L1)/3) THEN 25330
25310 L$[26,26]="1"
25320 GOTO 25340
25330 L$[26,26]="-"
25340 Y=L1*10/3
25342 Y0=(L1+1)*10/3
25350 FOR S1=2 TO S9
25360 IF S[12,S1] >= Y0 OR S[12,S1]<Y THEN 25400
25370 X1=INT(26+S[11,S1]/2)
25380 L$[X1,X1]="*"
25390 L$[X1+1,X1+4]=S$[S[8,S1],S[8,S1]+3]
25400 NEXT S1
25410 FOR I=55 TO 26 STEP -1
25420 IF L$[I,I] <> " " THEN 25440
25430 NEXT I
25440 PRINT L$[1,I]
25450 NEXT L1
25460 PRINT 
25470 PRINT "THE MAP IS 100 LIGHT-YEARS BY 100 LIGHT-YEARS,"
25480 PRINT "SO THE CROSS-LINES MARK 10 LIGHT-YEAR DISTANCES"
25490 RETURN
25500 END
