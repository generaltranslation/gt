<Tooltip
  title={frame.absPath}
  disabled={!(defined(frame.absPath) && frame.absPath !== frame.filename)}
  delay={tooltipDelay}
  isHoverable
>
  <FileName>
    {'('}
    {absoluteFilePaths ? frame.absPath : frame.filename}
    {frame.lineNo && `:${frame.lineNo}`}
    {')'}
  </FileName>
</Tooltip>;
