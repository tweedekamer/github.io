Web.on('loaded', (event) => Abis.init().then(async () => {
  const {config,Client,Panel,serviceClient} = Abis;
  const {definitions,serviceRoot,tutorial} = config;
  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(reader.result);
      reader.onerror = e => reject(reader.error);
      reader.onabort = e => reject(new Error("Read aborted"));
      reader.readAsDataURL(blob);
    });
  }
  const relations = [];
  Web.extend({
    Item: {
      prototype:{
        get lastModifiedDateTime() {
          return this.GewijzigdOp;
        },
        get startDateTime() {
          return this.Datum + ' ' + this.Aanvangstijd;
        },
        get endDateTime() {
          return this.Sluiting;
        },
      },
    },
    search(value) {
      console.debug(value);
      const url = new URL(document.location);
      const l = url.searchParams.get('l');
      Nav.set('$search', value);
      if (l) {
        const url = new URL(atob(l));
        const schemaName = url.pathname.split('/').pop();
        const schema = Item.getSchema(schemaName);
        const {cols} = schema;
        const searchValues = value.split(' ');
        const searchCols = cols.filter(col => col.search);
        const headerCols = cols.filter(col => col.header || col.filter);
        const $filter = searchValues.map(value => `(${searchCols.map(col => `contains(${col.name},'${value}')`).join(' or ')})`).join(' and ');
        const $select = headerCols.map(col => col.name).join(',');
        const $orderby = 'GewijzigdOp DESC';

        serviceClient.api(`/${schemaName}`).query({$select,$filter,$orderby}).get().then(body => Web.listview.render(body));
        console.debug(schemaName,schema,searchCols,cols);
      }
    },
  });
  config({
    definitions: {
      Activiteit: {
        prototype:{
          get startDateTime() {
            return this.Datum + ' ' + this.Aanvangstijd;
          },
          get endDateTime() {
            return this.Eindtijd;
          },
        },
      },
      Commissie: {
        prototype:{
          get startDateTime() {
            return this.DatumActief;
          },
          get endDateTime() {
            return this.DatumInactief;
          },
        },
      },
      Fractie: {
        prototype: {
          get iconSrc() {
            if (this.ContentType) {
              return this.href + '/resource';
            }
          },
          get pageNav() { return [
            $('button').class('icn-print').append($('nav').append(
              $('button').class('icn-document').caption('Partij opbouw').on('click', async (event) => {
                const fractie = this;
                const personen = [];
                const fractiezetels = await serviceClient.api(`/FractieZetel`).query({
                  $filter: `Fractie_Id eq ${fractie.id}`,
                  $top: 100,
                  $orderby: 'GewijzigdOp DESC',
                }).get().then(({value}) => value);
                cnt = 0;
                fractiezetels.forEach(fractieZetel => {
                  serviceClient.api(`/FractieZetelPersoon`).query({
                    $filter: `FractieZetel_Id eq ${fractieZetel.Id}`,
                  }).get().then(({value}) => value).then(fractieZetelPersonen => {
                    fractieZetelPersonen.forEach(fractieZetelPersoon => {
                      cnt++;
                      serviceClient.api(`/Persoon(${fractieZetelPersoon.Persoon_Id})`).get().then(persoon => {
                        Object.assign(persoon, {fractieZetelPersoon,fractieZetel,fractie})
                        personen.push(persoon);
                        ready();
                      });
                    });
                  });
                })
                const ready = () => {
                  if (--cnt) return;
                  personen.sort((a,b)=> {
                    if (a.fractieZetelPersoon.TotEnMet && !b.fractieZetelPersoon.TotEnMet) return 1;
                    if (!a.fractieZetelPersoon.TotEnMet && b.fractieZetelPersoon.TotEnMet) return -1;
                    if (!a.fractieZetelPersoon.TotEnMet && !b.fractieZetelPersoon.TotEnMet) return new Date(b.fractieZetelPersoon.Van).valueOf() > new Date(a.fractieZetelPersoon.Van).valueOf() ? 1 : -1;
                    return new Date(b.fractieZetelPersoon.TotEnMet).valueOf() > new Date(a.fractieZetelPersoon.TotEnMet).valueOf() ? 1 : -1;
                  })
                  $('div').append(
                    $('link').rel('stylesheet').href('https://aliconnect.nl/sdk-1.0.0/lib/aim/css/print.css'),
                    $('h1').text('Partij opbouw'),
                    $('div').text(fractie.Afkorting, fractie.NaamNL),
                    $('table').class('grid').append(
                      $('thead').append(
                        $('tr').append(
                          $('th').text('Naam').style('width:100%;'),
                          $('th').text('Gewicht'),
                          $('th').text('Functie'),
                          $('th').text('Van'),
                          $('th').text('TotEnMet'),
                        ),
                      ),
                      $('tbody').append(
                        personen.map(persoon => $('tr').append(
                          $('td').text(persoon.Achternaam+',', persoon.Titels, persoon.Voornamen),
                          $('td').text(persoon.fractieZetel.Gewicht),
                          $('td').text(persoon.fractieZetelPersoon.Functie),
                          $('td').style('white-space:nowrap;').text(new Date(persoon.fractieZetelPersoon.Van).toLocaleDateString()),
                          $('td').style('white-space:nowrap;').text(persoon.fractieZetelPersoon.TotEnMet ? new Date(persoon.fractieZetelPersoon.TotEnMet).toLocaleDateString() : ''),
                        ))
                      ),
                    ),
                  ).print();
                }
              }),
            )),
            this.buttonRelations(),
          ]},
        },
      },
      Persoon: {
        prototype: {
          get iconSrc() {
            if (this.ContentType) {
              return this.href + '/resource';
            }
          },
          get pageNav() { return [
            $('button').class('icn-print').append($('nav').append(
              $('button').class('icn-document').caption('Standpunten').on('click', async (event) => {
                const stemming = await serviceClient.api(`/Stemming`).query({
                  $filter: `Persoon_Id eq ${this.id}`,
                  $top: 100,
                  $orderby: 'GewijzigdOp DESC',
                }).get().then(({value}) => value);
                cnt = 0;
                if (!stemming.length) alert('Deze persoon heeft geen stem gedrag, probeer iemand anders.')
                for (let stem of stemming) {
                  $('.statusbar>progress').el.max++;
                  cnt++;
                  serviceClient.api(`/Besluit(${stem.Besluit_Id})`).get().then(besluit => {
                    $('.statusbar>progress').el.value++;
                    $('.statusbar>progress').el.max++;
                    serviceClient.api(`/Agendapunt(${besluit.Agendapunt_Id})`).get().then(agendapunt => {
                      $('.statusbar>progress').el.value++;
                      $('.statusbar>progress').el.max++;
                      serviceClient.api(`/Activiteit(${agendapunt.Activiteit_Id})`).get().then(activiteit => {
                        $('.statusbar>progress').el.value++;
                        Object.assign(stem,{besluit,agendapunt,activiteit});
                        ready();
                      });
                    });
                  });
                }
                const ready = () => {
                  if (--cnt) return;
                  $('.statusbar>progress').value(0).max(0);
                  // console.log(stemming);
                  $('div').append(
                    $('link').rel('stylesheet').href('https://aliconnect.nl/sdk-1.0.0/lib/aim/css/print.css'),
                    $('h1').text('Standpunten'),
                    $('div').text(this.Initialen, this.Voornamen, this.Roepnaam, this.Achternaam),
                    $('div').text(this.Functie),
                    $('table').class('grid').append(
                      $('thead').append(
                        $('tr').append(
                          $('th').text('Soort'),
                          $('th').text('Onderwerp').style('width:100%;'),
                        ),
                      ),
                      $('tbody').append(
                        stemming.sort((a,b)=>-a.Soort.localeCompare(b.Soort)).map(stem => $('tr').append(
                          $('td').text(stem.Soort),
                          $('td').text(stem.agendapunt.Onderwerp),
                        ))
                      ),
                    ),

                  ).print();
                }
              }),
            )),
            this.buttonRelations(),
          ]},
        },
      },
      Document: {
        prototype:{
          get pageNav() { return [
            this.buttonRelations(
              $('button').class('icn-text').caption('Inhoud als text').on('click', async (event) => {
                if (!this.ContentType) return;
                var {href} = this;
                href += '/resource';
                const {nav,elem,close} = new Panel;
                nav.style('position:relative;').append($('button').class('icn-back').type('button').on('click', close));
                elem.style('display: flex; flex-direction: column;');
                const divElem = $('div').parent(elem).style('flex:1 0 0;border:none;background:white;color:black;overflow-y:auto;white-space:pre-wrap;max-width:22cm;width:100%;margin:auto;line-height:1.5em;padding:20px;').text('Document wordt geannaliseerd. Ogenblik A.U.B.');
                switch (this.ContentType) {
                  case 'application/pdf': {
                    return Pdf.getPages(href).then(res => res.text(), err => console.error(err)).then(text => divElem.clear().html(text));
                  }
                  case 'application/msword': {
                    return Aim.fetch('https://aliconnect.nl/v1/doc2text').query({href}).get().then(content => divElem.clear().html(content));
                  }
                  case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
                    return Aim.fetch('https://aliconnect.nl/v1/docx2text').query({href}).get().then(content => divElem.clear().html(content));
                  }
                  case 'application/rtf': {
                    return Aim.fetch('https://aliconnect.nl/v1/rtf2text').query({href}).get().then(content => divElem.clear().html(content));
                  }
                }
              }),
              $('button').class('icn-scan').disabled(true).caption('Pdf OCR').on('click', async (event) => {
                if (!this.ContentType) return;
                var {href} = this;
                href += '/resource';
                const {nav,elem,close} = new Panel;
                nav.style('position:relative;').append($('button').class('icn-back').type('button').on('click', close));
                elem.style('display: flex; flex-direction: column;');
                const divElem = $('div').parent(elem).style('flex:1 0 0;border:none;background:white;color:black;overflow-y:auto;white-space:pre-wrap;max-width:22cm;width:100%;margin:auto;line-height:1.5em;padding:20px;').text('Document wordt geannaliseerd. Ogenblik A.U.B.');
                if (this.ContentType === 'application/pdf') {
                  var {href} = Aim.fetch('https://aliconnect.nl/v1/pdf_ocr').query({href});
                  Pdf.getPages(href)
                  .then(res => res.text().render(), err => console.error(err))
                  .then(text => divElem.clear().html(text))
                }
              }),
            ),
          ]},
          getResource(){
            if (!this.ContentType) return;
            var {href} = this;
            href += '/resource';
            if (this.ContentType === 'application/pdf') {
              const {nav,elem,close} = new Panel;
              nav.append(
                $('button').class('icn-back').type('button').on('click', close),
              );
              elem.style('display: flex; flex-direction: column;');
              const embed = $('embed').parent(elem).style('flex:1 0 auto;border:none;').type(this.ContentType).src(href)
            } else {
              $('a').href(href).download(this.Onderwerp).click().remove();
            }
          },
          getRowButtons(){
            if (this.ContentType) {
              return $('nav').append(
                $('button').class('icn-' + (this.ContentType === 'application/pdf' ? 'document_pdf' : 'arrow_download')).text('Bijlage').on('click', (event) => event.stopPropagation(this.getResource())),
              )
            }
          },
        },
      },
    },
  })
}, err => $(document.body).text('Deze pagina is niet beschikbaar')));
