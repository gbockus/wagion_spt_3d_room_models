# NOTES

- In order to get this working in the project, we needed to point the
`textFont` to `https://raw.githubusercontent.com/gbockus/wagion_spt_3d_room_models/master/src/js/fonts/helvetiker_regular.typeface.json`.
This should be changed to use the fonts directory, or have webpack pull into local project and reference from there.

- As it is now, the default width and height for the canvas is hardcoded to 
800 and 628, respectively. Might want to change this or make it configurable?


## License

The code is available under the [MIT license](LICENSE.txt).
