// https://datatables.net/examples/api/multi_filter.html
$(document).ready(function() {

    // Setup - add a text input to each footer cell
    $('#example tfoot th').each( function () {
        var title = $(this).text();
        $(this).html('<p><input type="text" placeholder="Search col."/></p>');
    } );

    // DataTable
    var table = $('#example').DataTable({
        paging: false,
        initComplete: function () {
            // Apply the search
            this.api().columns().every( function () {
                var that = this;
 
                $( 'input', this.footer() ).on( 'keyup change clear', function () {
                    if ( that.search() !== this.value ) {
                        that
                            .search( this.value )
                            .draw();
                    }
                });
            });
        }
    });
});