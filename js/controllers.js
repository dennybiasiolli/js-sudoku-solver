'use strict';

/* Controllers */

angular.module('myApp.controllers', [])
    .controller('myCtrl', ['$scope', '$location', '$timeout', function($scope, $location, $timeout) {
        $scope.initDB = function(){
            db.transaction(function(tx) {
                //tx.executeSql("DROP TABLE SudokuResolver");
                var strQuery="";
                strQuery+="CREATE TABLE IF NOT EXISTS SudokuResolver(";
                strQuery+="posX INT NOT NULL";
                strQuery+=",posY INT NOT NULL";
                strQuery+=",valN INT NOT NULL";
                strQuery+=",PRIMARY KEY (posX,posY,valN)";
                strQuery+=")";
                tx.executeSql(strQuery, [], null, function(tx, error){
                    alert("Error inserting SudokuResolver table.\n"+error.message);
                });
                tx.executeSql("DELETE FROM SudokuResolver WHERE 1", [], null, function(tx, error){
                    alert("Error inserting SudokuResolver tableCompleted!.\n"+error.message);
                });
                for(var x=0;x<9;x++){
                    for(var y=0;y<9;y++){
                        for(var n=1;n<=9;n++){
                            tx.executeSql("INSERT INTO SudokuResolver(posX,posY,valN)VALUES(?,?,?)", [x,y,n], null, function(tx, error){
                                alert("Error inserting SudokuResolver table.\n"+error.message);
                            });
                        }
                    }
                }
            });
        };

        $scope.risolvi_clic = function(){
            $scope.elaboraTabella(function(nScritti){
                //if(scriviValori()>0){
                if(nScritti>0){
                    //alert("Nuovo giro");
                    $timeout($scope.risolvi_clic(), 500);
                }
                else{
                    alert("Completed!");
                }
            });
        };

        $scope.mostraTabellaBase = function(){
            $("div.Tabella").hide("fast", function(){
                var strOut='';
                strOut += '<div class="Tabella">';
                for(var x=0;x<9;x++){
                    if(!(x%3)) strOut += '<div class="BordoH"></div>';
                    for(var y=0;y<9;y++){
                        if(!(y%3)) strOut += '<div class="BordoV"></div>';
                        strOut += '<input id="valN_'+x+'_'+y+'" class="Num" type="text" maxlength="1" data-x="'+x+'" data-y="'+y+'" ng-click="checkTasto(this,event)" />';
                    }
                    strOut += '<div class="BordoV"></div>';
                    strOut += '<br>';
                }
                strOut += '<div class="BordoH"></div>';
                strOut += '</div>';
                $("#status").show("fast", function(){
                    $("div.Tabella").html(strOut);
                    $("div.Tabella").show("fast", function(){
                        $("#status").hide("fast");
                    });
                });
            });
        };

        $scope.checkTasto = function(obj,e){
            var numcheck = /[1-9]/;
            var num = String.fromCharCode(e.which);
            obj.value="";
            if(numcheck.test(num))
                return(true);
            else
                return(false);
            //alert(obj.getAttribute('data-x') + "," + obj.getAttribute('data-y') + " : " + numcheck.test());
        };

        $scope.elaboraTabella = function(callback){
            //elimino i valori possibili in base ai dati presenti in tabella
            for(var x=0;x<9;x++){
                for(var y=0;y<9;y++){
                    var valN=$("#valN_"+x+"_"+y).val();
                    if(valN!="")
                        $scope.impostaVal(x,y,valN);
                }
            }
            var nTotScritti=0;
            $scope.controllaValoriUnici(function(nScritti1){
                nTotScritti+=nScritti1;
                $scope.controllaRigheUnivoche(function(nScritti2){
                    nTotScritti+=nScritti2;
                    $scope.controllaColonneUnivoche(function(nScritti3){
                        nTotScritti+=nScritti3;
                        //controllaQuadratiUnivoci(function(nScritti4){
                        //nTotScritti+=nScritti4;
                        callback(nTotScritti);
                        //});
                    });
                });
            });
        };

        $scope.controllaValoriUnici = function(callback){
            var nScritti=0;
            //controllo celle in cui può esserci solo quel numero
            db.transaction(function(tx) {
                var strQuery="";
                strQuery+="SELECT s.posX,s.posY,s.valN";
                strQuery+=" FROM SudokuResolver s INNER JOIN ";
                strQuery+="(SELECT s1.posX,s1.posY,COUNT(s1.valN) FROM SudokuResolver s1 GROUP BY s1.posX,s1.posY HAVING COUNT(s1.valN)=1) t1";
                strQuery+=" ON (s.posX=t1.posX AND s.posY=t1.posY)";
                tx.executeSql(strQuery, [],
                              function(tx, result) {
                    //alert(result.rows.length);
                    for(var i = 0; i < result.rows.length; i++) {
                        var x = result.rows.item(i)['posX'];
                        var y = result.rows.item(i)['posY'];
                        var n = result.rows.item(i)['valN'];
                        var valN=$("#valN_"+x+"_"+y).val();
                        if(valN==""){
                            $scope.impostaVal(x,y,n);
                            $("#valN_"+x+"_"+y).val(n);
                            nScritti++;
                        }
                    }
                    callback(nScritti);
                }, null);
            });
        };

        $scope.controllaRigheUnivoche = function(callback){
            var nScritti=0;
            //controllo righe in cui ci sono più valori possibili,
            //ma in cui solo in una cella è possibile un determinato valore
            db.transaction(function(tx) {
                var strQuery="";
                strQuery+="SELECT s.posX,s.posY,s.valN";
                strQuery+=" FROM SudokuResolver s INNER JOIN ";
                strQuery+="(SELECT s1.valN,s1.posX,COUNT(s1.posY) FROM SudokuResolver s1 GROUP BY s1.valN,s1.posX HAVING COUNT(s1.posY)=1) t1";
                strQuery+=" ON (s.valN=t1.valN AND s.posX=t1.posX)";
                tx.executeSql(strQuery, [],
                              function(tx, result) {
                    //alert(result.rows.length);
                    for(var i = 0; i < result.rows.length; i++) {
                        var x = result.rows.item(i)['posX'];
                        var y = result.rows.item(i)['posY'];
                        var n = result.rows.item(i)['valN'];
                        var valN=$("#valN_"+x+"_"+y).val();
                        if(valN==""){
                            $scope.impostaVal(x,y,n);
                            $("#valN_"+x+"_"+y).val(n);
                            nScritti++;
                        }
                    }
                    callback(nScritti);
                }, null);
            });
        };

        $scope.controllaColonneUnivoche = function(callback){
            var nScritti=0;
            //controllo righe in cui ci sono più valori possibili,
            //ma in cui solo in una cella è possibile un determinato valore
            db.transaction(function(tx) {
                var strQuery="";
                strQuery+="SELECT s.posX,s.posY,s.valN";
                strQuery+=" FROM SudokuResolver s INNER JOIN ";
                strQuery+="(SELECT s1.valN,s1.posY,COUNT(s1.posX) FROM SudokuResolver s1 GROUP BY s1.valN,s1.posY HAVING COUNT(s1.posX)=1) t1";
                strQuery+=" ON (s.valN=t1.valN AND s.posY=t1.posY)";
                tx.executeSql(strQuery, [],
                              function(tx, result) {
                    //alert(result.rows.length);
                    for(var i = 0; i < result.rows.length; i++) {
                        var x = result.rows.item(i)['posX'];
                        var y = result.rows.item(i)['posY'];
                        var n = result.rows.item(i)['valN'];
                        var valN=$("#valN_"+x+"_"+y).val();
                        if(valN==""){
                            $scope.impostaVal(x,y,n);
                            $("#valN_"+x+"_"+y).val(n);
                            nScritti++;
                        }
                    }
                    callback(nScritti);
                }, null);
            });
        };

        $scope.impostaVal = function(x, y, valN){
            tbl[x][y]=valN;
            db.transaction(function(tx) {
                var strQuery="";

                //scrivo il valore disponibile in quella cella
                tx.executeSql("DELETE FROM SudokuResolver WHERE valN<>? AND posX=? AND posY=?", [valN, x, y], null, null);

                //elimino il valN dalla riga e dalla colonna in cui è presente
                tx.executeSql("DELETE FROM SudokuResolver WHERE valN=? AND posX=? AND posY<>?", [valN, x, y], null, null);
                tx.executeSql("DELETE FROM SudokuResolver WHERE valN=? AND posX<>? AND posY=?", [valN, x, y], null, null);

                //elimino il valN dal quadrato in cui è presente
                var strQuery="";
                strQuery+="DELETE FROM SudokuResolver WHERE valN=?";
                strQuery+=" AND posX>=?";
                strQuery+=" AND posX<=?";
                strQuery+=" AND posY>=?";
                strQuery+=" AND posY<=?";
                tx.executeSql(strQuery, [valN, (Math.floor(x/3)*3), ((Math.floor(x/3)*3)+2), (Math.floor(y/3)*3), ((Math.floor(y/3)*3)+2)], null, null);
            });
        };

        $scope.scriviValori = function()/* int */{
            var scritti=0;
            for(var x=0;x<9;x++){
                for(var y=0;y<9;y++){
                    var valN=$("#valN_"+x+"_"+y).val();
                    if(valN=="" && tbl[x][y]){
                        $("#valN_"+x+"_"+y).val(tbl[x][y]);
                        scritti++;
                    }
                }
            }
            //alert("Scritti:"+scritti);
            return(scritti);
        };

        try{var db = openDatabase("SudokuResolver", "0.1", "Sudoku Resolver", 200000);}
        catch(ex){alert("Cannot create database.");}
        if(!db)
            alert("Cannot create database.");
        $scope.initDB();
        var tbl=new Array(9);
        for(var i=0;i<9;i++) tbl[i]=new Array(9);

        $scope.mostraTabellaBase();
    }]);
